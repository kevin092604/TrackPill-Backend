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

// Mapeo semilla de precios base en HNL (Lempiras). Tambien sirve como
// catalogo minimo de nombres conocidos cuando pharmacy_prices aun esta vacia.
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

const SEED_MEDICINE_DISPLAY_NAMES = {
  paracetamol: 'Paracetamol',
  ibuprofeno: 'Ibuprofeno',
  losartan: 'Losartán',
  omeprazol: 'Omeprazol',
  acetaminofen: 'Acetaminofén',
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
 * Distancia aproximada en kilometros entre dos coordenadas (formula haversine).
 */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(2));
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
 * Busca farmacias reales cercanas a unas coordenadas (OpenStreetMap Overpass),
 * con las farmacias de contingencia como respaldo si la API externa falla.
 */
async function fetchNearbyPharmacyLocations(lat, lng) {
  let rawPharmacies = [];

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

  if (rawPharmacies.length === 0) {
    rawPharmacies = getContingencyPharmacies(lat, lng);
  }

  return rawPharmacies;
}

/**
 * Resuelve el precio (real, promedio de la comunidad, o estimado) de un
 * medicamento en una farmacia especifica.
 */
async function resolvePriceForMedicineAtPharmacy(normalizedName, pharm) {
  const currency = COUNTRY_CURRENCIES[pharm.countryCode] || 'HNL';

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
      const matchedKey = Object.keys(BASE_PRICES_HNL).find(key => normalizedName.includes(key)) || 'default';
      const baseHnl = BASE_PRICES_HNL[matchedKey];
      const rate = HNL_EXCHANGE_RATES[currency] || 1.0;
      basePrice = baseHnl * rate;
    }

    const variationPercent = getHashVariation(pharm.placeId);
    price = Number((basePrice * (1 + variationPercent / 100)).toFixed(2));
  }

  return { price, currency, source };
}

/**
 * Busca farmacias reales cercanas y asocia precios reales o estimados para el medicamento especificado.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/20
 */
async function getNearbyPharmacies(medicineId, lat, lng, userId) {
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw createHttpError(404, 'Medicamento no encontrado.', 'medicine_not_found');
  }

  if (medicine.userId !== userId) {
    throw createHttpError(403, 'No tienes autorización para ver este medicamento.', 'unauthorized');
  }

  const normalizedName = normalizeMedicineName(medicine.name);
  const rawPharmacies = await fetchNearbyPharmacyLocations(lat, lng);
  const results = [];

  for (const pharm of rawPharmacies) {
    const { price, currency, source } = await resolvePriceForMedicineAtPharmacy(normalizedName, pharm);

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

  return results.sort((a, b) => a.price - b.price);
}

/**
 * HU-22 / SCRUM-138: listado general de farmacias cercanas con distancia y
 * detalle, sin atarlo a un medicamento especifico.
 */
async function getPharmaciesWithDistance(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const rawPharmacies = await fetchNearbyPharmacyLocations(latitude, longitude);

  return rawPharmacies
    .map((pharm) => ({
      placeId: pharm.placeId,
      name: pharm.name,
      latitude: Number(pharm.latitude),
      longitude: Number(pharm.longitude),
      address: pharm.address,
      countryCode: pharm.countryCode,
      distanceKm: haversineDistanceKm(latitude, longitude, Number(pharm.latitude), Number(pharm.longitude)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * HU-20 / SCRUM-131: busca medicamentos por termino y devuelve si hay
 * coincidencias, a partir del catalogo semilla y los nombres ya vistos en
 * pharmacy_prices (medicamentos que ya tienen precios registrados).
 */
async function searchMedicinesInPharmacies(searchTerm) {
  const normalizedTerm = normalizeMedicineName(searchTerm);

  if (!normalizedTerm) {
    return { medicines: [], hasMatches: false };
  }

  const dbMatchesQuery = await db.query(
    `SELECT DISTINCT medicine_name_normalized
     FROM medicine_stock.pharmacy_prices
     WHERE medicine_name_normalized LIKE $1
     ORDER BY medicine_name_normalized ASC
     LIMIT 20`,
    [`%${normalizedTerm}%`],
  );

  const namesFromDb = dbMatchesQuery.rows.map((row) => row.medicine_name_normalized);
  const namesFromSeed = Object.keys(SEED_MEDICINE_DISPLAY_NAMES)
    .filter((key) => key.includes(normalizedTerm) || normalizedTerm.includes(key));

  const uniqueNormalizedNames = [...new Set([...namesFromDb, ...namesFromSeed])];

  const medicines = uniqueNormalizedNames.map((normalizedName) => ({
    normalizedName,
    displayName: SEED_MEDICINE_DISPLAY_NAMES[normalizedName] || capitalize(normalizedName),
    available: true,
  }));

  return { medicines, hasMatches: medicines.length > 0 };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * HU-21 / SCRUM-134: dada una lista de nombres de medicamentos y una
 * ubicacion, calcula por farmacia el precio de cada medicamento, el costo
 * total, y destaca la farmacia mas economica.
 */
async function comparePricesAcrossPharmacies(medicineNames, lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const rawPharmacies = await fetchNearbyPharmacyLocations(latitude, longitude);
  const normalizedNames = medicineNames.map((name) => ({
    original: name,
    normalized: normalizeMedicineName(name),
  }));

  const results = [];

  for (const pharm of rawPharmacies) {
    const items = [];
    let totalCost = 0;

    for (const { original, normalized } of normalizedNames) {
      const { price, currency, source } = await resolvePriceForMedicineAtPharmacy(normalized, pharm);
      totalCost += price;
      items.push({ medicineName: original, price, currency, source });
    }

    results.push({
      placeId: pharm.placeId,
      name: pharm.name,
      address: pharm.address,
      distanceKm: haversineDistanceKm(latitude, longitude, Number(pharm.latitude), Number(pharm.longitude)),
      items,
      totalCost: Number(totalCost.toFixed(2)),
      currency: items[0]?.currency || 'HNL',
    });
  }

  results.sort((a, b) => a.totalCost - b.totalCost);

  return {
    pharmacies: results,
    cheapestPlaceId: results[0]?.placeId || null,
  };
}

module.exports = {
  getNearbyPharmacies,
  getPharmaciesWithDistance,
  searchMedicinesInPharmacies,
  comparePricesAcrossPharmacies,
};
