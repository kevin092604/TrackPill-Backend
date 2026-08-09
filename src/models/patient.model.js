const db = require('../config/db');

/**
 * Obtiene la próxima dosis programada de un paciente.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function getNextDose(patientId) {
    const result = await db.query(`
        SELECT 
            m.name AS medication_name, 
            ml.scheduled_time, 
            ds.name AS status
        FROM medicine_stock.medication_logs ml
        JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
        JOIN medicine_stock.dose_status ds ON ml.status_id = ds.id
        WHERE m.user_id = $1 AND ml.status_id = 1 -- 1 = Pendiente
        AND ml.scheduled_time >= NOW()
        ORDER BY ml.scheduled_time ASC
        LIMIT 1
    `, [patientId]);
    
    return result.rows[0] || null;
}

/**
 * Obtiene el historial reciente de tomas de un paciente.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function getRecentActivity(patientId, limit = 5) {
    const result = await db.query(`
        SELECT 
            m.name AS medication_name, 
            ml.taken_time, 
            ds.name AS status
        FROM medicine_stock.medication_logs ml
        JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
        JOIN medicine_stock.dose_status ds ON ml.status_id = ds.id
        WHERE m.user_id = $1 AND ml.status_id IN (2, 3) -- 2=Tomada, 3=Retrasada
        ORDER BY ml.taken_time DESC
        LIMIT $2
    `, [patientId, limit]);
    
    return result.rows;
}

/**
 * Calcula el cumplimiento semanal de un paciente (últimos 7 días).
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function getWeeklyCompliance(patientId) {
    const result = await db.query(`
        SELECT 
            COUNT(*) AS total_doses,
            SUM(CASE WHEN status_id = 2 THEN 1 ELSE 0 END) AS doses_taken
        FROM medicine_stock.medication_logs ml
        JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
        WHERE m.user_id = $1 
        AND ml.scheduled_time >= NOW() - INTERVAL '7 days'
        AND ml.scheduled_time <= NOW()
    `, [patientId]);
    
    const total = parseInt(result.rows[0].total_doses, 10) || 0;
    const taken = parseInt(result.rows[0].doses_taken, 10) || 0;
    const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
    
    return { percentage, dosesTaken: taken, totalDoses: total };
}

/**
 * Obtiene las dosis de hoy del paciente (programadas, completadas, pendientes).
 */
async function getTodayStats(patientId) {
    const result = await db.query(`
        SELECT 
            COUNT(*) AS total_scheduled,
            SUM(CASE WHEN ml.status_id = 2 THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN ml.status_id IN (1, 3) THEN 1 ELSE 0 END) AS pending
        FROM medicine_stock.medication_logs ml
        JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
        WHERE m.user_id = $1 
        AND ml.scheduled_time::date = CURRENT_DATE
    `, [patientId]);

    const scheduled = parseInt(result.rows[0]?.total_scheduled, 10) || 0;
    const completed = parseInt(result.rows[0]?.completed, 10) || 0;
    const pending = parseInt(result.rows[0]?.pending, 10) || 0;

    return { scheduled, completed, pending };
}

/**
 * Obtiene medicamentos con inventario bajo del paciente.
 */
async function getCriticalInventory(patientId) {
    const result = await db.query(`
        SELECT 
            m.id,
            m.name,
            m.current_stock AS remaining_stock,
            pf.name AS dose_unit
        FROM medicine_stock.medicines m
        JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
        WHERE m.user_id = $1 
        AND m.current_stock <= m.low_stock_threshold
        ORDER BY m.current_stock ASC
        LIMIT 3
    `, [patientId]);

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        remainingStock: parseFloat(row.remaining_stock),
        unit: row.dose_unit || 'tabletas',
    }));
}

/**
 * Obtiene la lista de medicamentos activos con el nombre del paciente.
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @since 2026/07/19
 */
async function getPatientMedicines(patientId) {
    const result = await db.query(`
        SELECT 
            m.id, 
            m.name, 
            m.dose AS dose_quantity, 
            m.current_stock AS remaining_stock, 
            pf.name AS dose_unit, 
            m.frequency, 
            tu.name AS frequency_unit,
            u.first_name
        FROM medicine_stock.medicines m
        JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
        JOIN medicine_stock.time_units tu ON m.time_unit_id = tu.id
        JOIN auth.users u ON m.user_id = u.id
        WHERE m.user_id = $1
    `, [patientId]);
    
    return result.rows;
}

module.exports = {
    getNextDose,
    getRecentActivity,
    getWeeklyCompliance,
    getTodayStats,
    getCriticalInventory,
    getPatientMedicines
};