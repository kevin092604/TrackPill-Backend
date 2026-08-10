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
async function getWeeklyCompliance(patientId, timezone = 'America/Tegucigalpa') {
    const tz = String(timezone || 'America/Tegucigalpa').trim();

    const weekDaysQuery = await db.query(
        `SELECT
            (date_trunc('week', NOW() AT TIME ZONE $1) + (i || ' day')::interval)::date::text AS date_str,
            to_char(date_trunc('week', NOW() AT TIME ZONE $1) + (i || ' day')::interval, 'Dy') AS day_code
         FROM generate_series(0, 6) AS i`,
        [ tz ]
    );

    const logsQuery = await db.query(
        `SELECT
            (ml.scheduled_time AT TIME ZONE $2)::date::text AS log_date,
            ml.status_id
         FROM medicine_stock.medication_logs ml
         JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
         WHERE m.user_id = $1
           AND (ml.scheduled_time AT TIME ZONE $2) >= date_trunc('week', NOW() AT TIME ZONE $2)
           AND (ml.scheduled_time AT TIME ZONE $2) < date_trunc('week', NOW() AT TIME ZONE $2) + INTERVAL '7 days'`,
        [ patientId, tz ]
    );

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let totalScheduled = 0;
    let totalTaken = 0;

    const days = weekDaysQuery.rows.map((dayRow, index) => {
        const dayLogs = logsQuery.rows.filter(log => log.log_date === dayRow.date_str);
        const scheduled = dayLogs.length;
        const completed = dayLogs.filter(log => log.status_id === 2).length;

        totalScheduled += scheduled;
        totalTaken += completed;

        let status = 'none';
        if (scheduled > 0) {
            if (completed === scheduled) {
                status = 'completed';
            } else if (completed > 0) {
                status = 'partial';
            } else {
                status = 'missed';
            }
        }

        return {
            key: dayNames[index],
            date: dayRow.date_str,
            scheduled,
            completed,
            status
        };
    });

    const percentage = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

    return { percentage, dosesTaken: totalTaken, totalDoses: totalScheduled, days };
}

/**
 * Obtiene las dosis de hoy del paciente (programadas, completadas, pendientes).
 */
async function getTodayStats(patientId) {
    const result = await db.query(`
        SELECT 
            COUNT(*) AS total_scheduled,
            SUM(CASE WHEN ml.status_id = 2 THEN 1 ELSE 0 END) AS completed
        FROM medicine_stock.medication_logs ml
        JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
        WHERE m.user_id = $1 
        AND ml.scheduled_time::date = CURRENT_DATE
    `, [patientId]);

    const scheduled = parseInt(result.rows[0]?.total_scheduled, 10) || 0;
    const completed = parseInt(result.rows[0]?.completed, 10) || 0;
    const pending = Math.max(0, scheduled - completed);

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
async function getPatientMedicines(patientId, search = '') {
    const query = `
        SELECT 
            m.id, 
            m.name, 
            m.image,
            m.dose AS dose_quantity, 
            m.current_stock AS remaining_stock, 
            pf.name AS pharmaceutical_form, 
            mu.code AS dose_unit,
            m.frequency, 
            tu.name AS frequency_unit,
            m.start_time,
            u.first_name,
            u.last_name
        FROM medicine_stock.medicines m
        JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
        LEFT JOIN medicine_stock.measurement_units mu ON pf.measurement_unit_id = mu.id
        JOIN medicine_stock.time_units tu ON m.time_unit_id = tu.id
        JOIN auth.users u ON m.user_id = u.id
        WHERE m.user_id = $1
          AND ($2 = '' OR m.name ILIKE $3)
        ORDER BY m.name ASC
    `;
    const result = await db.query(query, [patientId, search, `%${search}%`]);
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