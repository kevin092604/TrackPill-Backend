const db = require('../config/db');

function mapLog(row) {
  if (!row) return null;

  return {
    id: row.id,
    medicineId: row.medicine_id,
    scheduledTime: row.scheduled_time,
    takenTime: row.taken_time,
    statusId: row.status_id,
  };
}

async function findByIdForMedicine(id, medicineId, client = db) {
  const result = await client.query(
    `SELECT * FROM medicine_stock.medication_logs WHERE id = $1 AND medicine_id = $2`,
    [id, medicineId],
  );

  return mapLog(result.rows[0]);
}

async function updateStatus(id, statusId, takenTime, client = db) {
  const result = await client.query(
    `UPDATE medicine_stock.medication_logs
     SET status_id = $2, taken_time = $3
     WHERE id = $1
     RETURNING *`,
    [id, statusId, takenTime],
  );

  return mapLog(result.rows[0]);
}

/**
 * Historial de dosis del usuario agrupado por dia (HU-18 / SCRUM-126).
 */
async function findHistoryByUserId(userId, { from, to } = {}, client = db) {
  const result = await client.query(
    `SELECT
        ml.id,
        ml.scheduled_time,
        ml.taken_time,
        ds.name AS status_name,
        m.id AS medicine_id,
        m.name AS medicine_name
     FROM medicine_stock.medication_logs ml
     JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
     JOIN medicine_stock.dose_status ds ON ml.status_id = ds.id
     WHERE m.user_id = $1
       AND ($2::date IS NULL OR ml.scheduled_time >= $2::date)
       AND ($3::date IS NULL OR ml.scheduled_time < ($3::date + INTERVAL '1 day'))
     ORDER BY ml.scheduled_time DESC`,
    [userId, from || null, to || null],
  );

  return result.rows.map((row) => ({
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicine_name,
    scheduledTime: row.scheduled_time,
    takenTime: row.taken_time,
    status: row.status_name,
    date: new Date(row.scheduled_time).toISOString().slice(0, 10),
  }));
}

module.exports = {
  findByIdForMedicine,
  updateStatus,
  findHistoryByUserId,
};
