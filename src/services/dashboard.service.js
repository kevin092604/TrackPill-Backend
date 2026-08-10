const { pool } = require('../config/db');

/**
 * Calcula los límites de fecha (Inicio del Lunes, Fin del Domingo) de la semana actual.
 */
function getCurrentWeekBounds() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // Corrección: getDay() en vez de getDate() para el día de la semana (0-6)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
}

/**
 * Función que obtiene el resumen del dashboard para un paciente.
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/07/02
 * @date 2026/07/18
 * @param {number} patientId ID del paciente
 * @returns {Promise<Object>} Objeto con el resumen del dashboard
 */
async function getPatientSummary(patientId, userTimezone = 'America/Tegucigalpa') {
    const tz = String(userTimezone || 'America/Tegucigalpa').trim();
    const now = new Date();

    const todayQuery = await pool.query(
        `SELECT
            COUNT(ml.id)::int AS scheduled,
            COUNT(CASE WHEN ml.status_id = 2 THEN 1 END)::int AS completed,
            COUNT(CASE WHEN ml.status_id IN (1,3) THEN 1 END)::int AS pending
         FROM medicine_stock.medication_logs ml
         JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
         WHERE m.user_id = $1
            AND (ml.scheduled_time AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date`,
        [ patientId, tz ]
    );

    const today = todayQuery.rows[0] || { scheduled: 0, completed: 0, pending: 0 };

    const activeQuery = await pool.query(
        `SELECT COUNT(id)::int AS active_count
         FROM medicine_stock.medicines
         WHERE user_id = $1 AND current_stock > 0`,
        [ patientId ]
    );
    const activeMedicinesCount = activeQuery.rows[0]?.active_count || 0;

    const nextDoseQuery = await pool.query(
        `SELECT
            ml.id,
            m.name AS medicine_name,
            ml.scheduled_time,
            m.dose,
            pf.name AS pharmaceutical_form
         FROM medicine_stock.medication_logs ml
         JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
         JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
         WHERE m.user_id = $1
            AND ml.scheduled_time >= NOW() - INTERVAL '1 hour'
            AND ml.status_id IN (1,3)
         ORDER BY ml.scheduled_time ASC
         LIMIT 1`,
        [ patientId ]
    );

    const dbNextDose = nextDoseQuery.rows[0];
    const nextDose = dbNextDose ? {
        id: dbNextDose.id,
        medicationName: dbNextDose.medicine_name,
        scheduledTime: dbNextDose.scheduled_time,
        dose: `${Number(dbNextDose.dose)} ${dbNextDose.pharmaceutical_form}`
    } : null;

    const weekDaysQuery = await pool.query(
        `SELECT
            (date_trunc('week', NOW() AT TIME ZONE $1) + (i || ' day')::interval)::date::text AS date_str,
            to_char(date_trunc('week', NOW() AT TIME ZONE $1) + (i || ' day')::interval, 'Dy') AS day_code
         FROM generate_series(0, 6) AS i`,
        [ tz ]
    );

    const weeklyLogsQuery = await pool.query(
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
    const weeklyLogs = weeklyLogsQuery.rows;

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyAdherence = weekDaysQuery.rows.map((dayRow, index) => {
        const dayLogs = weeklyLogs.filter(log => log.log_date === dayRow.date_str);
        const scheduled = dayLogs.length;
        const completed = dayLogs.filter(log => log.status_id === 2).length;
        const pending = scheduled - completed;
        const percentage = scheduled > 0 ? Number(((completed / scheduled) * 100).toFixed(1)) : 0;

        return {
            day: dayNames[index],
            scheduled,
            completed,
            pending,
            percentage
        };
    });

    return {
        today,
        activeMedicinesCount,
        nextDose,
        weeklyAdherence
    };
}

/**
 * Función que obtiene el resumen del dashboard para un cuidador.
 * @author Jesús Zepeda
 * @version 0.2.0
 * @since 2026/07/03
 * @date 2026/07/18
 * @param {number} caregiverId ID del cuidador
 * @param {string} userTimezone Zona horaria del cliente
 * @returns {Promise<Object[]>} Objeto con el resumen del dashboard por paciente
 */
async function getCaregiverSummary(caregiverId, userTimezone = 'America/Tegucigalpa') {
    const tz = String(userTimezone || 'America/Tegucigalpa').trim();
    const now = new Date();

    const patientsQuery = await pool.query(
        `SELECT
            r.patient_id,
            r.relationship_label,
            u.first_name,
            u.last_name,
            u.email,
            u.photo_url
         FROM auth.caregiver_relationships r
         JOIN auth.users u ON r.patient_id = u.id
         WHERE r.caregiver_id = $1
            AND r.status = 'aceptada'
            AND r.active = TRUE`,
        [ caregiverId ]
    );

    const patients = patientsQuery.rows;
    const summaries = [];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (const pat of patients) {
        const todayQuery = await pool.query(
            `SELECT
                COUNT(ml.id)::int AS scheduled,
                COUNT(CASE WHEN ml.status_id = 2 THEN 1 END)::int AS completed,
                COUNT(CASE WHEN ml.status_id IN (1,3) THEN 1 END)::int AS pending
             FROM medicine_stock.medication_logs ml
             JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
             WHERE m.user_id = $1
                AND (ml.scheduled_time AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date`,
            [ pat.patient_id, tz ]
        );
        
        const todayAdherence = todayQuery.rows[0] || { scheduled: 0, completed: 0, pending: 0 };
        todayAdherence.percentage = todayAdherence.scheduled > 0
            ? Math.round((todayAdherence.completed / todayAdherence.scheduled) * 100)
            : 0;
        
        const nextDoseQuery = await pool.query(
            `SELECT
                m.name AS medicine_name,
                ml.scheduled_time,
                m.dose,
                pf.name AS pharmaceutical_form
             FROM medicine_stock.medication_logs ml
             JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
             JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
             WHERE m.user_id = $1
                AND ml.scheduled_time > $2
                AND ml.status_id IN (1,3)
             ORDER BY ml.scheduled_time ASC
             LIMIT 1`,
             [ pat.patient_id, now ]
        );

        const dbNextDose = nextDoseQuery.rows[0];
        let nextDose = null;
        if (dbNextDose) {
            const diffMs = new Date(dbNextDose.scheduled_time) - now;
            const diffHrs = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
            nextDose = {
                medicationName: dbNextDose.medicine_name,
                scheduledTime: dbNextDose.scheduled_time,
                dose: `${Number(dbNextDose.dose)} ${dbNextDose.pharmaceutical_form}`,
                timeRemainingText: `En ${diffHrs} horas`
            };
        }
        
        const lastActivityQuery = await pool.query(
            `SELECT 
                m.name AS medicine_name,
                ml.taken_time,
                m.dose,
                pf.name AS pharmaceutical_form
             FROM medicine_stock.medication_logs ml
             JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
             JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
             WHERE m.user_id = $1
               AND ml.status_id = 2
               AND ml.taken_time IS NOT NULL
             ORDER BY ml.taken_time DESC
             LIMIT 1`,
            [ pat.patient_id ]
        );
        const dbLastActivity = lastActivityQuery.rows[0];
        let lastActivity = null;
        if (dbLastActivity) {
            const diffMs = now - new Date(dbLastActivity.taken_time);
            const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)));
            let timeAgoText = `${diffMins} minutos`;
            if (diffMins >= 60) {
                timeAgoText = `${Math.round(diffMins / 60)} horas`;
            }
            lastActivity = {
                medicationName: dbLastActivity.medicine_name,
                takenTime: dbLastActivity.taken_time,
                dose: `${Number(dbLastActivity.dose)} ${dbLastActivity.pharmaceutical_form}`,
                timeAgoText: `Hace ${timeAgoText}`
            };
        }

        const criticalInventoryQuery = await pool.query(
            `SELECT 
                m.id,
                m.name,
                m.current_stock,
                pf.name AS pharmaceutical_form
             FROM medicine_stock.medicines m
             JOIN medicine_stock.pharmaceutical_forms pf ON m.pharmaceutical_form_id = pf.id
             WHERE m.user_id = $1
               AND m.low_stock_alert_enabled = TRUE
               AND m.current_stock <= m.low_stock_threshold`,
            [ pat.patient_id ]
        );
        const criticalInventory = criticalInventoryQuery.rows.map(row => ({
            id: row.id,
            name: row.name,
            currentStock: Number(row.current_stock),
            pharmaceuticalForm: row.pharmaceutical_form
        }));

        const { monday, sunday } = getCurrentWeekBounds();
        const weeklyLogsQuery = await pool.query(
            `SELECT 
                ml.scheduled_time,
                ml.status_id
             FROM medicine_stock.medication_logs ml
             JOIN medicine_stock.medicines m ON ml.medicine_id = m.id
             WHERE m.user_id = $1
               AND ml.scheduled_time >= $2
               AND ml.scheduled_time <= $3`,
            [ pat.patient_id, monday, sunday ]
        );
        const weeklyLogs = weeklyLogsQuery.rows;
        const weeklyCompliance = [];
        let totalScheduled = 0;
        let totalCompleted = 0;

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(monday);
            dayDate.setDate(monday.getDate() + i);

            const dayLogs = weeklyLogs.filter(log => {
                const logDate = new Date(log.scheduled_time);
                return logDate.toDateString() === dayDate.toDateString();
            });

            let status = 'none';
            if (dayLogs.length > 0) {
                totalScheduled += dayLogs.length;
                const completedCount = dayLogs.filter(log => log.status_id === 2).length;
                totalCompleted += completedCount;

                status = completedCount === dayLogs.length ? 'completed' : 'failed';
            }

            weeklyCompliance.push({
                day: dayNames[i],
                status
            });
        }

        const weeklyCompliancePercentage = totalScheduled > 0
            ? Math.round((totalCompleted / totalScheduled) * 100)
            : 0;

        summaries.push({
            id: pat.patient_id,
            firstName: pat.first_name,
            lastName: pat.last_name,
            email: pat.email,
            photoUrl: pat.photo_url || null,
            relationshipLabel: pat.relationship_label,
            todayAdherence,
            nextDose,
            lastActivity,
            criticalInventory,
            weeklyCompliance,
            weeklyCompliancePercentage
        });
    }

    return summaries;
}

module.exports = {
    getPatientSummary,
    getCaregiverSummary,
};