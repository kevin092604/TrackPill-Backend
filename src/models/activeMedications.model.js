const  db  = require('../config/db');

/**
 * Busca los medicamentos activos de un usuario.
 * @author agblandin@unah.hn
 * @since 2026/07/20
 * @date 2026/07/07
 * @version 0.1.0
 */
async function findActiveMedications(userId, search = '', client = db) {
  const query = `
    SELECT 
        m.id,
        m.name,
        m.image,
        m.dose,
        m.frequency,
        m.start_time,
        tu.name AS time_unit,
        pf.name AS pharmaceutical_form,
        mu.code AS dose_unit
     FROM medicine_stock.medicines m
     JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
     JOIN medicine_stock.measurement_units mu ON pf.measurement_unit_id = mu.id
     JOIN medicine_stock.time_units tu ON m.time_unit_id = tu.id
     WHERE m.user_id = $1
       AND ($2 = '' OR m.name ILIKE $3)
     ORDER BY m.name ASC
  `;
  
  const result = await client.query(query, [userId, search, `%${search}%`]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    dose: Number(row.dose),
    frequency: row.frequency,
    startTime: row.start_time,
    timeUnit: row.time_unit,
    pharmaceuticalForm: row.pharmaceutical_form,
    doseUnit: row.dose_unit
  }));
}

module.exports = {
  findActiveMedications
};