const db = require('../config/db');

function mapCaregiverRelationship(row) {
  if (!row) {
    return null;
  }

  return {
    active: row.active,
    caregiverId: row.caregiver_id,
    id: row.id,
    initiatedBy: row.initiated_by,
    invitationChannel: row.invitation_channel,
    invitationDate: row.invitation_date,
    lastStatusChange: row.last_status_change,
    patientId: row.patient_id,
    relationshipLabel: row.relationship_label,
    responseDate: row.response_date,
    status: row.status,
  };
}

async function create(relationship, client = db) {
  const result = await client.query(
    `
      INSERT INTO auth.caregiver_relationships (
        caregiver_id,
        patient_id,
        relationship_label,
        initiated_by,
        status,
        active,
        invitation_channel,
        invitation_date,
        response_date,
        last_status_change
      )
      VALUES ($1, $2, $3, $4, 'pendiente', FALSE, $5, NOW(), NULL, NOW())
      RETURNING *
    `,
    [
      relationship.caregiverId,
      relationship.patientId,
      relationship.relationshipLabel,
      relationship.initiatedBy,
      relationship.invitationChannel,
    ],
  );

  return mapCaregiverRelationship(result.rows[0]);
}

async function findOpenBetween(firstUserId, secondUserId, client = db) {
  const result = await client.query(
    `
      SELECT *
      FROM auth.caregiver_relationships
      WHERE status IN ('pendiente', 'aceptada')
        AND (
          (caregiver_id = $1 AND patient_id = $2)
          OR (caregiver_id = $2 AND patient_id = $1)
        )
      LIMIT 1
    `,
    [firstUserId, secondUserId],
  );

  return mapCaregiverRelationship(result.rows[0]);
}

module.exports = {
  create,
  findOpenBetween,
  mapCaregiverRelationship,
};
