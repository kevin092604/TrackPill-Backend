const savedListService = require('../services/saved-medicine-list.service');

async function getLists(req, res, next) {
  try {
    const lists = await savedListService.getLists(req.user.id);
    res.status(200).json({ success: true, lists });
  } catch (error) {
    next(error);
  }
}

async function getList(req, res, next) {
  try {
    const list = await savedListService.getList(Number(req.params.id), req.user.id);
    res.status(200).json({ success: true, list });
  } catch (error) {
    next(error);
  }
}

async function createList(req, res, next) {
  try {
    const result = await savedListService.createList(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function updateList(req, res, next) {
  try {
    const result = await savedListService.updateList(Number(req.params.id), req.user.id, req.body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function deleteList(req, res, next) {
  try {
    const result = await savedListService.deleteList(Number(req.params.id), req.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function generateOwnList(req, res, next) {
  try {
    const result = await savedListService.generateOwnList(req.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function generatePatientList(req, res, next) {
  try {
    const result = await savedListService.generatePatientList(req.user.id, req.params.patientId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
  generateOwnList,
  generatePatientList,
};
