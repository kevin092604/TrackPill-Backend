const { z } = require('zod');

const pharmacyService = require('../services/pharmacy.service');
const { createHttpError } = require('../utils/helpers');

const compareSchema = z.object({
  medicineNames: z.array(z.string().trim().min(1)).min(1, 'Agrega al menos un medicamento para comparar.'),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

async function listNearby(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      throw createHttpError(400, 'Se requieren latitud (lat) y longitud (lng).', 'bad_request');
    }

    const pharmacies = await pharmacyService.getPharmaciesWithDistance(lat, lng);

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

    const { medicineNames, lat, lng } = result.data;
    const comparison = await pharmacyService.comparePricesAcrossPharmacies(medicineNames, lat, lng);

    res.status(200).json({ success: true, ...comparison });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNearby,
  search,
  compare,
};
