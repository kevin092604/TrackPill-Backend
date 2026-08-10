const { z } = require('zod');

const pharmacyService = require('../services/pharmacy.service');
const searchHistoryService = require('../services/pharmacy-search-history.service');
const { createHttpError } = require('../utils/helpers');

const compareSchema = z.object({
  medicineNames: z.array(z.string().trim().min(1)).min(1, 'Agrega al menos un medicamento para comparar.'),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  maxDistanceKm: z.coerce.number().positive().optional(),
});

async function listNearby(req, res, next) {
  try {
    const { lat, lng, maxDistanceKm } = req.query;
    if (!lat || !lng) {
      throw createHttpError(400, 'Se requieren latitud (lat) y longitud (lng).', 'bad_request');
    }

    const pharmacies = await pharmacyService.getPharmaciesWithDistance(
      lat,
      lng,
      maxDistanceKm ? Number(maxDistanceKm) : undefined,
    );

    res.status(200).json({ success: true, pharmacies });
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    const searchTerm = req.query.q || req.query.search || '';
    if (!searchTerm.trim()) {
      throw createHttpError(400, 'Se requiere un termino de busqueda (q).', 'bad_request');
    }

    const result = await pharmacyService.searchMedicinesInPharmacies(searchTerm);

    // Registro real del historial de búsquedas del usuario (mockup "Historial
    // de búsquedas"). No bloquea la respuesta si falla.
    searchHistoryService.logSearch(req.user.id, searchTerm).catch(() => {});

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function compare(req, res, next) {
  try {
    const result = compareSchema.safeParse(req.body);
    if (!result.success) {
      throw createHttpError(422, result.error.issues[0].message, 'validation_error');
    }

    const { medicineNames, lat, lng, maxDistanceKm } = result.data;
    const comparison = await pharmacyService.comparePricesAcrossPharmacies(medicineNames, lat, lng, maxDistanceKm);

    res.status(200).json({ success: true, ...comparison });
  } catch (error) {
    next(error);
  }
}

async function getSearchHistory(req, res, next) {
  try {
    const history = await searchHistoryService.getHistory(req.user.id);
    res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
}

async function removeSearchHistoryEntry(req, res, next) {
  try {
    const result = await searchHistoryService.removeEntry(req.user.id, Number(req.params.id));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function clearSearchHistory(req, res, next) {
  try {
    const result = await searchHistoryService.clearHistory(req.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function route(req, res, next) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      throw createHttpError(400, 'Se requieren fromLat, fromLng, toLat y toLng.', 'bad_request');
    }

    const routeInfo = await pharmacyService.getDrivingRoute(
      Number(fromLat),
      Number(fromLng),
      Number(toLat),
      Number(toLng),
    );

    res.status(200).json({ success: true, route: routeInfo });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNearby,
  search,
  compare,
  getSearchHistory,
  removeSearchHistoryEntry,
  clearSearchHistory,
  route,
};
