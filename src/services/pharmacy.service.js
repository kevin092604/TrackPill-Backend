const db = require('../config/db');
const Medicine = require('../models/medicine.model');
const { normalizeMedicineName } = require('../utils/string.helper');
const { createHttpError } = require('../utils/helpers');

// Mapa de divisas según el código del país
const COUNTRY_CURRENCIES = {
  HN: 'HNL', // Honduras
  SV: 'USD', // El Salvador
  MX: 'MXN', // México
  GT: 'GTQ', // Guatemala
};

// Mapeo semilla de precios base en HNL (Lempiras)
const BASE_PRICES_HNL = {
  paracetamol: 40.00,
  ibuprofeno: 60.00,
  losartan: 120.00,
  omeprazol: 80.00,
  acetaminofen: 50.00,
  default: 100.00,
};

// Tasas de cambio fijas aproximadas con base al HNL para el fallback multidivisa
const HNL_EXCHANGE_RATES = {
  HNL: 1.0,
  USD: 0.04,  // 1 HNL = 0.04 USD (aprox 24.6 HNL por USD)
  MXN: 0.72,  // 1 HNL = 0.72 MXN
  GTQ: 0.31,  // 1 HNL = 0.31 GTQ
};

/**
 * Genera una variación determinista del precio en porcentaje (-15% a +15%) basada en el ID de la farmacia.
 * Esto asegura que los precios simulados no cambien al refrescar la pantalla.
 */
function getHashVariation(stringId) {
  let hash = 0;
  for (let i = 0; i < stringId.length; i++) {
    hash = stringId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 31) - 15; // Genera un rango de -15 a +15
}

/**
 * Devuelve farmacias de contingencia en Honduras cerca de las coordenadas del usuario en caso de falla de API externa.
 */
function getContingencyPharmacies(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return [
    {
      placeId: 'mock_kielsa_1',
      name: 'Farmacias Kielsa',
      latitude: latitude + 0.002,
      longitude: longitude - 0.001,
      address: 'Bulevar Morazán, Tegucigalpa, Honduras',
      countryCode: 'HN',
    },
    {
      placeId: 'mock_siman_2',
      name: 'Farmacias Simán',
      latitude: latitude - 0.003,
      longitude: longitude + 0.002,
      address: 'Colonia Palmira, Tegucigalpa, Honduras',
      countryCode: 'HN',
    },
    {
      placeId: 'mock_ahorro_3',
      name: 'Farmacias del Ahorro Honduras',
      latitude: latitude + 0.001,
      longitude: longitude + 0.003,
      address: 'Centro Histórico, Tegucigalpa, Honduras',
      countryCode: 'HN',
    },
  ];
}

/**
 * Busca farmacias reales cercanas y asocia precios reales o estimados para el medicamento especificado.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/20
 */
async function getNearbyPharmacies(medicineId, lat, lng, userId) {
  // 1. Obtener el medicamento del usuario
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw createHttpError(404, 'Medicamento no encontrado.', 'medicine_not_found');
  }

  if (medicine.userId !== userId) {
    throw createHttpError(403, 'No tienes autorización para ver este medicamento.', 'unauthorized');
  }

  const normalizedName = normalizeMedicineName(medicine.name);
  let rawPharmacies = [];

  // 2. Intentar llamar a la API externa de OpenStreetMap (Overpass)
  try {
    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["amenity"="pharmacy"](around:5000, ${lat}, ${lng});
        way["amenity"="pharmacy"](around:5000, ${lat}, ${lng});
      );
      out center;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.elements && data.elements.length > 0) {
        rawPharmacies = data.elements.map(el => {
          const name = el.tags?.name || 'Farmacia Local';
          const latitude = el.lat || el.center?.lat;
          const longitude = el.lon || el.center?.lon;
          const countryCode = (el.tags?.['addr:country'] || 'HN').toUpperCase();
          const city = el.tags?.['addr:city'] || '';
          const street = el.tags?.['addr:street'] || '';
          const address = [street, city].filter(Boolean).join(', ') || 'Dirección no disponible';

          return {
            placeId: String(el.id),
            name,
            latitude,
            longitude,
            address,
            countryCode,
          };
        });
      }
    }
  } catch (error) {
    console.warn('[PHARMACY_SERVICE] Error consultando OpenStreetMap, usando farmacias de contingencia:', error.message);
  }

  // Si no se encontraron farmacias o falló la API, usamos la lista de contingencia
  if (rawPharmacies.length === 0) {
    rawPharmacies = getContingencyPharmacies(lat, lng);
  }

  const results = [];

  // 3. Resolver precio y stock para cada farmacia
  for (const pharm of rawPharmacies) {
    const currency = COUNTRY_CURRENCIES[pharm.countryCode] || 'HNL';

    // A. Intentar obtener el precio real directo en esa farmacia
    const directPriceQuery = await db.query(
      `SELECT price, currency 
       FROM medicine_stock.pharmacy_prices
       WHERE medicine_name_normalized = $1 
         AND pharmacy_place_id = $2
       LIMIT 1`,
      [normalizedName, pharm.placeId]
    );

    let price = null;
    let source = 'estimated';

    if (directPriceQuery.rows.length > 0) {
      price = Number(directPriceQuery.rows[0].price);
      source = 'real';
    } else {
      // B. Intentar obtener el precio promedio en ese país
      const avgPriceQuery = await db.query(
        `SELECT AVG(price)::numeric(10,2) AS avg_price 
         FROM medicine_stock.pharmacy_prices
         WHERE medicine_name_normalized = $1 
           AND country_code = $2`,
        [normalizedName, pharm.countryCode]
      );

      const dbAvg = avgPriceQuery.rows[0]?.avg_price;

      let basePrice = 0;

      if (dbAvg) {
        basePrice = Number(dbAvg);
        source = 'crowd_sourced';
      } else {
        // C. Fallback: Precio base estático convertido a la moneda local
        // Buscamos si la medicina coincide con alguna palabra clave
        const matchedKey = Object.keys(BASE_PRICES_HNL).find(key => normalizedName.includes(key)) || 'default';
        const baseHnl = BASE_PRICES_HNL[matchedKey];

        // Convertir HNL a moneda del país usando tasas de cambio estáticas
        const rate = HNL_EXCHANGE_RATES[currency] || 1.0;
        basePrice = baseHnl * rate;
      }

      // Aplicar la variación determinista por Hash de farmacia
      const variationPercent = getHashVariation(pharm.placeId);
      price = Number((basePrice * (1 + variationPercent / 100)).toFixed(2));
    }

    results.push({
      placeId: pharm.placeId,
      name: pharm.name,
      latitude: Number(pharm.latitude),
      longitude: Number(pharm.longitude),
      address: pharm.address,
      countryCode: pharm.countryCode,
      price,
      currency,
      source,
    });
  }

  // Ordenar por precio ascendente para destacar la opción más económica
  return results.sort((a, b) => a.price - b.price);
}

module.exports = {
  getNearbyPharmacies,
};
