/**
 * Normaliza el nombre de un medicamento para unificarlo y permitir búsquedas de comparación estables.
 * Remueve espacios, signos de puntuación, acentos y lo convierte a minúsculas.
 * Ejemplo: "Losartán 50 mg" -> "losartan50mg"
 * @param {string} name Nombre del medicamento a normalizar.
 * @returns {string} Nombre normalizado.
 */
function normalizeMedicineName(name) {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    // Remover acentos/diacríticos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remover todo lo que no sea alfanumérico (letras y números)
    .replace(/[^a-z0-9]/g, '');
}

module.exports = {
  normalizeMedicineName,
};
