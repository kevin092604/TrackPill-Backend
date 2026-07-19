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

/**
 * Busca todos los medicamentos de un usuario, opcionalmente filtrados por nombre.
 */
async function findAllByUserId(userId, search = '', client = db) {
  const result = await client.query(
    `SELECT 
        m.id,
        m.name,
        m.image,
        m.dose,
        m.frequency,
        tu.name AS time_unit,
        pf.name AS pharmaceutical_form,
        m.current_stock,
        m.low_stock_threshold,
        m.low_stock_alert_enabled
     FROM medicine_stock.medicines m
     JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
     JOIN medicine_stock.time_units tu ON m.time_unit_id = tu.id
     WHERE m.user_id = $1
       AND ($2 = '' OR m.name ILIKE $3)
     ORDER BY m.name ASC`,
    [userId, search, `%${search}%`]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    image: row.image,
    dose: Number(row.dose),
    frequency: row.frequency,
    timeUnit: row.time_unit,
    pharmaceuticalForm: row.pharmaceutical_form,
    currentStock: Number(row.current_stock),
    lowStockThreshold: row.low_stock_threshold ? Number(row.low_stock_threshold) : null,
    lowStockAlertEnabled: row.low_stock_alert_enabled
  }));
}

/**
 * Obtiene el detalle completo de un medicamento con su presentación y planificación horaria semanal.
 */
async function findDetailById(medicineId, client = db) {
  const result = await client.query(
    `SELECT 
        m.id,
        m.name,
        m.image,
        m.pharmaceutical_form_id,
        m.current_stock,
        m.dose,
        m.frequency,
        m.time_unit_id,
        m.start_time,
        m.schedule_id,
        m.description,
        m.low_stock_alert_enabled,
        m.low_stock_threshold,
        m.user_id,
        pf.name AS pharmaceutical_form_name,
        tu.name AS time_unit_name,
        s.start_date,
        s.end_date,
        s.monday,
        s.tuesday,
        s.wednesday,
        s.thursday,
        s.friday,
        s.saturday,
        s.sunday
     FROM medicine_stock.medicines m
     JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
     JOIN medicine_stock.time_units tu ON m.time_unit_id = tu.id
     JOIN medicine_stock.schedules s ON m.schedule_id = s.id
     WHERE m.id = $1
     LIMIT 1`,
    [medicineId]
  );
  
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    image: row.image,
    pharmaceuticalFormId: row.pharmaceutical_form_id,
    pharmaceuticalFormName: row.pharmaceutical_form_name,
    currentStock: Number(row.current_stock),
    dose: Number(row.dose),
    frequency: row.frequency,
    timeUnitId: row.time_unit_id,
    timeUnitName: row.time_unit_name,
    startTime: row.start_time,
    scheduleId: row.schedule_id,
    description: row.description,
    lowStockAlertEnabled: row.low_stock_alert_enabled,
    lowStockThreshold: row.low_stock_threshold ? Number(row.low_stock_threshold) : null,
    userId: row.user_id,
    schedule: {
      startDate: row.start_date,
      endDate: row.end_date,
      monday: row.monday,
      tuesday: row.tuesday,
      wednesday: row.wednesday,
      thursday: row.thursday,
      friday: row.friday,
      saturday: row.saturday,
      sunday: row.sunday
    }
  };
}

module.exports = {
  create,
  findById,
  updateStock,
  findAllByUserId,
  findDetailById,
  mapMedicine,
};
