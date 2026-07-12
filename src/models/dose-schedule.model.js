const db = require('../config/db');

function mapDoseSchedule(row) {
  if (!row) {
    return null;
  }

  return {
    creationDate: row.creation_date,
    id: row.id,
    medicationId: row.medication_id,
    scheduledTime: row.scheduled_time,
  };
}

async function createMany(medicationId, scheduledTimes, client = db) {
  const rows = await Promise.all(
    scheduledTimes.map((scheduledTime) => client.query(
      `
        INSERT INTO medication.dose_schedules (medication_id, scheduled_time, creation_date)
        VALUES ($1, $2, NOW())
        RETURNING *
      `,
      [medicationId, scheduledTime],
    )),
  );

  return rows.map((result) => mapDoseSchedule(result.rows[0]));
}

async function findByMedicationId(medicationId, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM medication.dose_schedules
      WHERE medication_id = $1
      ORDER BY scheduled_time ASC
    `,
    [medicationId],
  );

  return result.rows.map(mapDoseSchedule);
}

module.exports = {
  createMany,
  findByMedicationId,
  mapDoseSchedule,
};
