const db = require('../config/db');


function mapMedicine(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    image: row.image,
    pharmaceuticalFormId: row.pharmaceutical_form_id,
    currentStock: Number(row.current_stock),
    dose: Number(row.dose),
    frequency: row.frequency,
    timeUnitId: row.time_unit_id,
    startTime: row.start_time,
    scheduleId: row.schedule_id,
    description: row.description,
    lowStockAlertEnabled: row.low_stock_alert_enabled,
    lowStockThreshold: row.low_stock_threshold ? Number(row.low_stock_threshold) : null,
    userId: row.user_id,
  };
}

async function create(medicine, client = db) {
  const result = await client.query(
    `
      INSERT INTO medicine_stock.medicines (
        name,
        image,
        pharmaceutical_form_id,
        current_stock,
        dose,
        frequency,
        time_unit_id,
        start_time,
        schedule_id,
        description,
        low_stock_alert_enabled,
        low_stock_threshold,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
    [
      medicine.name,
      medicine.image || null,
      medicine.pharmaceuticalFormId,
      medicine.currentStock,
      medicine.dose,
      medicine.frequency,
      medicine.timeUnitId,
      medicine.startTime,
      medicine.scheduleId,
      medicine.description || null,
      medicine.lowStockAlertEnabled,
      medicine.lowStockThreshold || null,
      medicine.userId,
    ],
  );

  return mapMedicine(result.rows[0]);
}

/**
 * Función que permite buscar un medicamento por su identificador
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {number} id Identificador del medicamento
 * @param {PoolClient} client Cliente de la base de datos
 * @returns {Promise<object>} Objeto con la información del medicamento
 */
async function findById(id, client = db) {
  const result = await client.query(
    'SELECT * FROM medicine_stock.medicines WHERE id = $1 LIMIT 1',
    [id]
  );
  return mapMedicine(result.rows[0]);
}

/**
 * Función que permite actualizar el stock de un medicamento
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {number} id Identificador del medicamento
 * @param {number} newStock Nuevo stock del medicamento
 * @param {PoolClient} client Cliente de la base de datos
 * @returns {Promise<object>} Objeto con la información del medicamento
 */
async function updateStock(id, newStock, client = db) {
  const result = await client.query(
    `UPDATE medicine_stock.medicines
     SET current_stock = $2
     WHERE id = $1
     RETURNING *`,
    [id, newStock]
  );
  return mapMedicine(result.rows[0]);
}

module.exports = {
  create,
  findById,
  updateStock,
  mapMedicine,
};
