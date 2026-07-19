const db = require('../config/db');

/**
 * Función que permite crear un nuevo horario para un medicamento
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {object} schedule Objeto con la información del horario
 * @param {PoolClient} client Cliente de la base de datos
 * @returns {Promise<object>} Objeto con la información del horario
 */
async function create(schedule, client = db) {
    const result = await client.query(
        `INSERT INTO medicine_stock.schedules (
            start_date,
            end_date,
            monday,
            tuesday,
            wednesday,
            thursday,
            friday,
            saturday,
            sunday
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *;`,
        [
            schedule.startDate || null,
            schedule.endDate || null,
            schedule.monday || false,
            schedule.tuesday || false,
            schedule.wednesday || false,
            schedule.thursday || false,
            schedule.friday || false,
            schedule.saturday || false,
            schedule.sunday || false,
        ]
    );
    return result.rows[0];
}

/**
 * Función que permite actualizar dinámicamente el horario.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function update(id, data, client = db) {
  const fields = [];
  const values = [];
  let index = 1;

  if (data.startDate !== undefined) { fields.push(`start_date = $${index++}`); values.push(data.startDate); }
  if (data.endDate !== undefined) { fields.push(`end_date = $${index++}`); values.push(data.endDate); }
  if (data.monday !== undefined) { fields.push(`monday = $${index++}`); values.push(data.monday); }
  if (data.tuesday !== undefined) { fields.push(`tuesday = $${index++}`); values.push(data.tuesday); }
  if (data.wednesday !== undefined) { fields.push(`wednesday = $${index++}`); values.push(data.wednesday); }
  if (data.thursday !== undefined) { fields.push(`thursday = $${index++}`); values.push(data.thursday); }
  if (data.friday !== undefined) { fields.push(`friday = $${index++}`); values.push(data.friday); }
  if (data.saturday !== undefined) { fields.push(`saturday = $${index++}`); values.push(data.saturday); }
  if (data.sunday !== undefined) { fields.push(`sunday = $${index++}`); values.push(data.sunday); }

  if (fields.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE medicine_stock.schedules
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING *
  `;
  
  const result = await client.query(query, values);
  return result.rows[0];
}

module.exports = {
    create,
    update
};