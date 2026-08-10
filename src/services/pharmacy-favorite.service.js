const { z } = require('zod');

const PharmacyFavorite = require('../models/pharmacy-favorite.model');
const { createHttpError } = require('../utils/helpers');

const addFavoriteSchema = z.object({
  placeId: z.string().trim().min(1, 'Falta el identificador de la farmacia.'),
  name: z.string().trim().min(1, 'Falta el nombre de la farmacia.'),
  address: z.string().trim().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  countryCode: z.string().trim().optional(),
});

async function getFavorites(userId) {
  return PharmacyFavorite.findByUserId(userId);
}

async function addFavorite(userId, payload) {
  const result = addFavoriteSchema.safeParse(payload);
  if (!result.success) throw createHttpError(422, result.error.issues[0].message, 'validation_error');

  const favorite = await PharmacyFavorite.create(userId, result.data);
  return { action: 'pharmacy_favorite_added', status: 'success', favorite };
}

async function removeFavorite(userId, placeId) {
  if (!placeId) throw createHttpError(400, 'Falta el identificador de la farmacia.', 'bad_request');

  await PharmacyFavorite.remove(userId, placeId);
  return { action: 'pharmacy_favorite_removed', status: 'success' };
}

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
};
