const { z } = require('zod');
const { createHttpError } = require('./helpers');

/**
 * Schema string de zod que permite validar el email.
 * @author cdcruzr@unah.hn, https://zod.dev/api
 * @version 2026/06/17
 * @since 2026/06/17
 */
const validarEmail = z.string()
  .trim()
  .toLowerCase()
  .email({ message: 'correo inválido' });

/**
 * Schema string de zod que permite validar el password
 * @author cdcruzr@unah.hn, https://zod.dev/api
 * @version 2026/06/17
 * @since 2026/06/17
 */
const validatorPass = z.string()
  .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  .regex(/^[^<>]*$/, { message: 'Por seguridad, no se permiten los caracteres < o >' })
  .regex(/[A-Z]/, { message: 'Debe contener al menos una letra mayúscula' })
  .regex(/[a-z]/, { message: 'Debe contener al menos una letra minúscula' })
  .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
  .regex(/[^A-Za-z0-9]/, { message: 'Debe contener al menos un carácter especial (ej. @, #, $, etc.)' });

/**
 * Schema object para validar todo el payload de Registro
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @date 2026/06/21
 * @since 2026/06/21
 */
const registrationSchema = z.object({
  email: validarEmail,
  password: validatorPass,
  firstName: z.string()
    .trim()
    .min(1, "Debe ingresar su nombre.")
    .max(120, "El nombre es demasiado largo."),
  lastName: z.string()
    .trim()
    .min(1, "Debe ingresar  su apellido.")
    .max(120, "El apellido es demasiado largo."),
  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato de fecha AAAA-MM-DD."),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say'], {
    errorMap: () => ({ message: "Selecciona un género válido." })
  }),
  phone: z.string()
    .trim()
    .transform(val => val.replace(/\D/g, '')) 
    .refine(val => val.length >= 8 && val.length <= 15, {
      message: "Ingresa un teléfono válido."
    })
});

/**
 * Función que ejecuta la validación de loa datos de un nuevo usuario
 * @author agblandin@unah.hn
 * @version 0.1.0
 * @date 2026/06/21
 * @since 2026/06/21
 */
function validateRegistrationData(payload) {
  const result = registrationSchema.safeParse(payload);
  
  if (!result.success) {
    
    const firstError = result.error.errors[0].message;
    throw createHttpError(422, firstError, 'validation_error');
  }
  
  return result.data; 
}

module.exports = {
  validateRegistrationData,
};