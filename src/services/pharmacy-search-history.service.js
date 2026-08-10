const SearchHistory = require('../models/pharmacy-search-history.model');
const { createHttpError } = require('../utils/helpers');

async function getHistory(userId) {
  return SearchHistory.findByUserId(userId);
}

async function logSearch(userId, searchTerm) {
  const trimmed = (searchTerm || '').trim();
  if (!trimmed) return null;

  return SearchHistory.create(userId, trimmed);
}

async function removeEntry(userId, id) {
  if (!id) throw createHttpError(400, 'Falta el identificador del historial.', 'bad_request');

  await SearchHistory.remove(userId, id);
  return { action: 'search_history_removed', status: 'success' };
}

async function clearHistory(userId) {
  await SearchHistory.clear(userId);
  return { action: 'search_history_cleared', status: 'success' };
}

module.exports = {
  getHistory,
  logSearch,
  removeEntry,
  clearHistory,
};
