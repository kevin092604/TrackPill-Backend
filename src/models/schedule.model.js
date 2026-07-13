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

module.exports = {
    create,
};