const db = require('../config/db');
const Medicine = require('../models/medicine.model');
const Notification = require('../models/notification.model');
const { createHttpError } = require('../utils/helpers');

/**
 * Función que registra un movimiento de stock y verifica si se debe activar la alerta de inventario bajo.
 * @author Jesús Zepeda
 * @version 0.1.0
 * @since 2026/07/12
 * @date 2026/07/12
 * @param {string|number} medicineId ID del medicamento.
 * @param {string|number} amount Cantidad del movimiento.
 * @param {string|number} movementTypeId ID del tipo de movimiento.
 * @param {object} client Cliente de la base de datos.
 * @returns {Promise<object>} Objeto con el medicamento actualizado.
 */
async function recordStockMovement(medicineId, amount, movementTypeId, client = db) {

    const medicine = await Medicine.findById(medicineId, client);

    if (!medicine) {
        throw createHttpError(404, 'Medicamento no encontrado.', 'medicine_not_found');
    }

    const movementTypeResult = await client.query(
        'SELECT factor FROM medicine_stock.movement_types WHERE id = $1',
        [movementTypeId]
    );

    if (movementTypeResult.rows.length === 0) {
        throw createHttpError(404, 'Tipo de movimiento inválido.', 'invalid_movement_type');
    }

    const factor = movementTypeResult.rows[0].factor;
    const stockChange = Number(amount) * factor;

    const newStock = medicine.currentStock + stockChange;

    if (newStock < 0) {
        throw createHttpError(400, 'El inventario no puede ser menor a cero.', 'invalid_stock_value');
    }

    await client.query(
        `INSERT INTO medicine_stock.stock_movements (
            medicine_id,
            amount,
            movement_type_id,
            movement_date
         )
         VALUES ($1, $2, $3, NOW())`,
        [medicineId, amount, movementTypeId]
    );

    const updatedMedicine = await Medicine.updateStock(medicineId, newStock, client);

    if (updatedMedicine.lowStockAlertEnabled && updatedMedicine.lowStockThreshold !== null) {
        
        if (newStock <= updatedMedicine.lowStockThreshold) {

            const message = `Alerta de inventario: El stock de ${updatedMedicine.name} es bajo (${newStock} restantes).`;
            
            const dupCheckPatient = await client.query(
                `SELECT id FROM medicine_stock.notifications
                 WHERE user_id = $1
                    AND medicine_id = $2
                    AND type = 'low_inventory'
                    AND is_read = FALSE
                 LIMIT 1`,
                [
                    updatedMedicine.userId,
                    medicineId,
                ]
            );

            if (dupCheckPatient.rows.length === 0) {

                await Notification.create(
                    {
                        userId: updatedMedicine.userId,
                        type: 'low_inventory',
                        message,
                        // patientId se deja null: es la notificacion del propio
                        // paciente sobre su propio medicamento, no tiene sentido
                        // referenciarlo como "paciente relacionado" a si mismo,
                        // y ademas viola el CHECK user_id <> patient_id.
                        patientId: null,
                        medicineId: updatedMedicine.id,
                        doseId: null
                    },
                    client
                );

                console.info(`[INVENTORY] Alerta de inventario bajo generada para el usuario ID ${updatedMedicine.userId}`);
            }

            const caregiverResult = await client.query(
                `SELECT caregiver_id
                 FROM auth.caregiver_relationships
                 WHERE patient_id = $1
                    AND status = 'aceptada'
                    AND active = TRUE`,
                [updatedMedicine.userId]
            );

            const caregivers = caregiverResult.rows;

            for (const caregiver of caregivers) {
                const dupCheckCaregiver = await client.query(
                    `SELECT id FROM medicine_stock.notifications
                     WHERE user_id = $1
                        AND medicine_id = $2
                        AND type = 'low_inventory'
                        AND is_read = FALSE
                     LIMIT 1`,
                    [
                        caregiver.caregiver_id,
                        medicineId,
                    ]
                );

                if (dupCheckCaregiver.rows.length === 0) {
                    await Notification.create(
                        {
                            userId: caregiver.caregiver_id,
                            type: 'low_inventory',
                            message,
                            patientId: updatedMedicine.userId,
                            medicineId: updatedMedicine.id,
                            doseId: null
                        },
                        client
                    );
                    console.info(`[INVENTORY] Alerta de inventario bajo generada para el cuidador ID ${caregiver.caregiver_id}`);
                }
            }
        }
    }

    return updatedMedicine;
}

module.exports = {
    recordStockMovement,
};