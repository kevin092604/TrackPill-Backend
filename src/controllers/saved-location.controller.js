const locationService = require('../services/saved-location.service');

async function list(req, res, next) {
  try {
    const locations = await locationService.getLocations(req.user.id);
    res.status(200).json({ success: true, locations });
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  try {
    const result = await locationService.addLocation(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await locationService.removeLocation(req.user.id, Number(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function geocode(req, res, next) {
  try {
    const results = await locationService.geocodeAddress(req.query.q);
    res.status(200).json({ success: true, results });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  add,
  remove,
  geocode,
};
