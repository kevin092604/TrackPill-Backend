const { z } = require('zod');

const SavedLocation = require('../models/saved-location.model');
const { createHttpError } = require('../utils/helpers');

const createLocationSchema = z.object({
  label: z.string().trim().min(1, 'Ingresa un nombre para la ubicación.').max(120),
  address: z.string().trim().max(500).optional(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  isDefault: z.boolean().optional(),
});

async function getLocations(userId) {
  return SavedLocation.findByUserId(userId);
}

async function addLocation(userId, payload) {
  const result = createLocationSchema.safeParse(payload);
  if (!result.success) throw createHttpError(422, result.error.issues[0].message, 'validation_error');

  const location = await SavedLocation.create(userId, result.data);
  return { action: 'saved_location_created', status: 'success', location };
}

async function removeLocation(userId, id) {
  const existing = await SavedLocation.findById(id);
  if (!existing) throw createHttpError(404, 'Ubicación no encontrada.', 'saved_location_not_found');
  if (existing.userId !== userId) throw createHttpError(403, 'No tienes permiso para eliminar esta ubicación.', 'unauthorized');

  await SavedLocation.remove(userId, id);
  return { action: 'saved_location_deleted', status: 'success' };
}

/**
 * Geocodificacion real de una direccion de texto a coordenadas, via el
 * servicio publico Nominatim (OpenStreetMap), mismo ecosistema que Overpass.
 * Sin esto, "Agregar ubicación por dirección" no tendria datos reales.
 */
async function geocodeAddress(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) throw createHttpError(400, 'Ingresa una dirección para buscar.', 'bad_request');

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`;
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'TrackPill/1.0 (contacto: soporte@trackpill.app)' },
    });
  } catch (error) {
    throw createHttpError(502, 'No fue posible conectar con el servicio de direcciones.', 'geocoding_unreachable');
  }

  if (!response.ok) {
    throw createHttpError(502, 'No fue posible buscar la dirección.', 'geocoding_error');
  }

  const results = await response.json();

  return results.map((item) => ({
    address: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}

module.exports = {
  getLocations,
  addLocation,
  removeLocation,
  geocodeAddress,
};
