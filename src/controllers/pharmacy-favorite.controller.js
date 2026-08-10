const favoriteService = require('../services/pharmacy-favorite.service');

async function list(req, res, next) {
  try {
    const favorites = await favoriteService.getFavorites(req.user.id);
    res.status(200).json({ success: true, favorites });
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  try {
    const result = await favoriteService.addFavorite(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await favoriteService.removeFavorite(req.user.id, req.params.placeId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  add,
  remove,
};
