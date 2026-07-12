const db = require('../config/db');

function mapMedication(row) {
  if (!row) {
    return null;
  }

  return {
    active: row.active,
    creationDate: row.creation_date,
    currentInventory: row.current_inventory,
    doseAmount: row.dose_amount,
    doseUnit: row.dose_unit,
    frequencyType: row.frequency_type,
    id: row.id,
    lastUpdate: row.last_update,
    lowStockAlertEnabled: row.low_stock_alert_enabled,
    lowStockThreshold: row.low_stock_threshold,
    name: row.name,
    pharmaceuticalForm: row.pharmaceutical_form,
    photoUrl: row.photo_url,
    userId: row.user_id,
  };
}

async function create(medication, client = db) {
  const result = await client.query(
    `
      INSERT INTO medication.medications (
        user_id,
        name,
        pharmaceutical_form,
        dose_amount,
        dose_unit,
        photo_url,
        frequency_type,
        current_inventory,
        low_stock_alert_enabled,
        low_stock_threshold,
        creation_date,
        last_update
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `,
    [
      medication.userId,
      medication.name,
      medication.pharmaceuticalForm,
      medication.doseAmount,
      medication.doseUnit,
      medication.photoUrl || null,
      medication.frequencyType,
      medication.currentInventory,
      medication.lowStockAlertEnabled,
      medication.lowStockThreshold || null,
    ],
  );

  return mapMedication(result.rows[0]);
}

async function updatePhotoUrl(medicationId, photoUrl, client = db) {
  const result = await client.query(
    `
      UPDATE medication.medications
      SET photo_url = $2,
          last_update = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [medicationId, photoUrl],
  );

  return mapMedication(result.rows[0]);
}

async function findActiveByUserId(userId, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM medication.medications
      WHERE user_id = $1
        AND active = TRUE
      ORDER BY creation_date DESC
    `,
    [userId],
  );

  return result.rows.map(mapMedication);
}

async function findById(id, client = db) {
  const result = await client.query(
    'SELECT * FROM medication.medications WHERE id = $1 LIMIT 1',
    [id],
  );

  return mapMedication(result.rows[0]);
}

module.exports = {
  create,
  findActiveByUserId,
  findById,
  mapMedication,
  updatePhotoUrl,
};
