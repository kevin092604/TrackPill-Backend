# TrackPill Backend

API Node.js + Express para TrackPill.

## Estructura

```text
src/
|-- config/
|   |-- db.js
|   `-- schema.sql
|-- controllers/
|   `-- auth.controller.js
|-- middlewares/
|   `-- auth.middleware.js
|-- models/
|   |-- email-credential.model.js
|   |-- pending-social-registration.model.js
|   |-- provider-type.model.js
|   |-- session.model.js
|   |-- social-provider.model.js
|   |-- user.model.js
|   `-- verification-code.model.js
|-- routes/
|   `-- auth.routes.js
|-- services/
|   |-- auth.service.js
|   `-- social-provider.service.js
|-- utils/
|   `-- helpers.js
`-- app.js
```

## Configuracion

```bash
npm install
copy .env.example .env
```

Completa las credenciales de PostgreSQL, JWT y proveedores sociales en `.env`.

Para levantar PostgreSQL con Docker:

```bash
docker compose up -d postgres
```

Esto crea el contenedor `trackpill-postgres`, expone PostgreSQL en `localhost:5432`
y usa estos valores compatibles con `.env.example`:

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/trackpill
```

Para crear las tablas base:

```bash
psql "%DATABASE_URL%" -f src/config/schema.sql
```

## Modelo de datos

El backend sigue el diagrama base en PostgreSQL:

- `User`
- `EmailCredential`
- `VerificationCode`
- `ProviderType`
- `SocialProvider`
- `PendingSocialRegistration`
- `Session`

Los proveedores sociales no se guardan embebidos en `User`; se vinculan mediante
`SocialProvider` y `ProviderType`.
`User` incluye `email_verified` y `email_verified_date` para registrar correos
verificados por proveedores sociales sin crear una credencial de password.
`PendingSocialRegistration` conserva temporalmente datos verificados por el
proveedor mientras el usuario completa el registro complementario. Esto cubre
casos como Apple, donde el correo puede no volver a venir en intentos posteriores.

En SQL se usan nombres plurales para evitar palabras reservadas:

- `users`
- `email_credentials`
- `verification_codes`
- `provider_types`
- `social_providers`
- `pending_social_registrations`
- `sessions`

## Endpoint social auth

`POST /auth/social`

Recibe una credencial de Google, Apple o Facebook, la verifica contra el proveedor,
busca si el usuario existe y responde una de estas acciones:

- `login_direct`: la cuenta ya estaba vinculada a ese proveedor.
- `linked_existing_account`: existe una cuenta con el mismo correo verificado por el proveedor y se vinculo el proveedor.
- `registration_required`: no existe cuenta y se debe completar el registro complementario.

Ejemplo:

```json
{
  "provider": "google",
  "credential": {
    "idToken": "provider-id-token",
    "accessToken": "provider-access-token"
  },
  "profile": {
    "email": "usuario@example.com",
    "givenName": "Kevin",
    "familyName": "Lopez"
  },
  "platform": "ios"
}
```

## Endpoint completar registro social

`POST /auth/social/complete-register`

Recibe el `registrationToken` devuelto por `/auth/social` y los campos faltantes
del usuario. Si el correo ya existe y fue verificado por el proveedor, vincula la
cuenta existente; si no existe, crea el usuario, vincula el proveedor y devuelve
un token de autenticacion. Para cuentas nuevas, el correo recibido del proveedor
social queda marcado como verificado automaticamente.

`POST /auth/social-register` queda disponible como alias temporal para clientes
anteriores.

Ejemplo:

```json
{
  "provider": "google",
  "registrationToken": "social-registration-token",
  "user": {
    "firstName": "Kevin",
    "lastName": "Lopez",
    "dateOfBirth": "2000-01-20",
    "gender": "male",
    "phone": "+502 0000 0000"
  }
}
```

## Callback Apple web

`GET|POST /auth/apple/callback`

Este endpoint recibe el retorno web de Sign in with Apple para Android/Web y
redirige de vuelta a la app usando el esquema permitido, por ejemplo:

```text
trackpill://auth/apple
```

En Apple Developer, el Services ID debe usar como Return URL publica:

```text
https://tu-api.com/auth/apple/callback
```

Variables relacionadas:

```env
APPLE_SERVICE_ID=com.trackpill.app.service
APPLE_CALLBACK_ALLOWED_SCHEMES=trackpill
APPLE_CALLBACK_ALLOWED_ORIGINS=https://tu-web.com
```

## Endpoint login tradicional

`POST /auth/login`

Recibe las credenciales el correo electrónico y contraseña de un usuario, valida su identidad contra los registros de la base de datos y genera una nueva sesión, retornando los tokens de acceso correspondientes.

### Ejemplo de petición

```json
{
  "email": "agblandin@unah.com",
  "password": "@#$12Vxeeee"
}
```

## Endpoint registro tradicional

`POST /auth/register`

Crea el usuario con correo y contraseña, genera un código de verificación de 6
dígitos, lo almacena con expiración de 10 minutos y lo envía al correo
registrado.

```json
{
  "email": "usuario@example.com",
  "password": "@#$12Vxeeee",
  "firstName": "Kevin",
  "lastName": "Garcia",
  "birthDate": "2000-01-20",
  "gender": "male",
  "phone": "+50400000000"
}
```

## Endpoint verificar correo

`POST /auth/verify-email`

Valida el código de 6 dígitos. Si es correcto, no ha expirado y no fue usado,
marca el correo como verificado, crea una sesión y retorna token de
autenticación.

```json
{
  "email": "usuario@example.com",
  "code": "123456"
}
```

Respuesta exitosa:

```json
{
  "success": true,
  "action": "email_verified",
  "status": "success",
  "token": "jwt",
  "refreshToken": "token",
  "user": {}
}
```

## Endpoint verificar código de recuperación

`POST /auth/verify-code`

Valida que el código de verificación recibido (generado para la recuperación de contraseña) corresponda al correo electrónico especificado, que no haya expirado y que no haya sido utilizado previamente. Si la validación es correcta, marca el código como utilizado y retorna un token JWT temporal (`resetToken`) con validez de 10 minutos para autorizar el restablecimiento de la contraseña.

### Ejemplo de petición

```json
{
  "email": "usuario@example.com",
  "code": "123456"
}
```

Respuesta exitosa:

```json
{
  "success": true,
  "action": "password_reset_allowed",
  "status": "success",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX..."
}
```

Respuestas de error comunes:

- 400 Bad Request (Falta email o código):

```json
{
  "success": false,
  "code": "missing_code",
  "message": "El código de verificación es requerido."
}
```

- 401 Unauthorized (Código inválido o expirado):

```json
{
  "success": false,
  "code": "invalid_verification_code",
  "message": "Código de verificación incorrecto."
}
```

- 409 Conflict (Código ya utilizado):

```json
{
  "success": false,
  "code": "verification_code_used",
  "message": "Este código ya ha sido utilizado."
}
```

- 410 Gone (Código expirado):

```json
{
  "success": false,
  "code": "verification_code_expired",
  "message": "El código de verificación ha expirado."
}
```

## Solicitar recuperacion de contrasena

`POST /auth/forgot-password`

Genera un codigo de 6 digitos, lo almacena como `forgotten_password` con
expiracion de 10 minutos y lo envia al correo registrado.

```json
{
  "email": "usuario@example.com"
}
```

## Endpoint reenviar codigo de verificacion

`POST /auth/resend-email-verification`

Genera un nuevo codigo de 6 digitos para un usuario pendiente de verificacion,
marca como usados los codigos anteriores y envia el nuevo codigo por correo con
expiracion de 10 minutos.

```json
{
  "email": "usuario@example.com"
}
```

## Restablecer contrasena

`POST /auth/reset-password`

Recibe el `resetToken` devuelto por `/auth/verify-code` y la nueva contrasena.
Valida las reglas de seguridad, actualiza el hash y revoca las sesiones activas.

```json
{
  "resetToken": "jwt-temporal",
  "password": "NuevaClave1!"
}
```

## Endpoint de obtener el círculo de cuidado

`GET /relationships?direction=<caregivers|patients>`

Obtiene la lista de relaciones aceptadas. La dirección puede ser `caregivers`
(para cuidadores que tiene el usuario) o `patients` (para pacientes asignados a
este usuario si es cuidador).

### Ejemplo de Respuesta:

```json
{
  "success": true,
  "relationships": [
    {
      "id": "1",
      "caregiverId": "2",
      "patientId": "1",
      "relationshipLabel": "Hijo",
      "active": true,
      "status": "aceptada",
      "user": {
        "id": "2",
        "firstName": "Kevin",
        "lastName": "Lopez",
        "email": "kevin@example.com"
      }
    }
  ]
}
```


## Endpoint de solicitar relación

`POST /relationships/request`

Envía una solicitud de relación a otro usuario.

### Ejemplo de Petición:

```json
{
  "initiatedAs": "caregiver",
  "email": "paciente@example.com",
  "relationshipLabel": "Papá"
}
```

## Endpoint de crear token de invitación

`POST /relationships/invite-token`

Genera un token temporal para ser escaneado por QR o enviado por enlace para iniciar una relación de cuidado.

### Ejemplo de Petición:

```json
{
  "initiatedAs": "caregiver",
  "invitationChannel": "qr"
}
```

## Endpoint de canjear token de invitación

`POST /relationships/redeem-token`

Canjea un token de invitación activo para crear el vínculo.

### Ejemplo de Petición:

```json
{
  "token": "qr.invitation-token-uuid",
  "relationshipLabel": "Abuelo"
}
```

## Endpoint de responder a una solicitud de relación

`POST /relationships/:id/respond`

Acepta o rechaza una solicitud de relación pendiente.

### Ejemplo de Petición:

```json
{
  "status": "aceptada"
}
```

## Endpoint de pausar o reactivar vínculo de cuidado

`PATCH /relationships/:id/active`

Pausa o reactiva temporalmente una relación activa.

### Ejemplo de Petición:

```json
{
  "active": false
}
```

## Endpoint de eliminar relación

`DELETE /relationships/:id`

Marca la relación como eliminada de forma definitiva.

---

## Endpoint de obtener calendario del paciente

`GET /caregiver/patients/:patientId/calendar?month=YYYY-MM`

Obtiene el listado de tomas y calendario del mes solicitado de un paciente específico asignado a este cuidador. Valida de forma estricta que exista una relación aceptada y activa (`active = true`) entre el cuidador y el paciente.

### Ejemplo de Respuesta:

```json
{
  "success": true,
  "data": {
    "patientId": 1,
    "month": "2026-07",
    "events": []
  }
}
```


## Endpoint de obtener detalle diario de dosis

`GET /caregiver/patients/:patientId/doses?date=YYYY-MM-DD`

Obtiene el detalle de dosis y tomas diarias para un paciente específico asignado a este cuidador en una fecha solicitada. Valida de forma estricta que exista una relación aceptada y activa (`active = true`) entre el cuidador y el paciente.

### Ejemplo de Respuesta:

```json
{
  "success": true,
  "data": {
    "patientId": 1,
    "date": "2026-07-12",
    "doses": []
  }
}
```

## Correo Gmail

Usa una contrasena de aplicacion de Google, no la contrasena normal de la
cuenta. Configura estas variables:

```env
SMTP_SERVICE=gmail
GMAIL_USER=cuenta@gmail.com
GMAIL_APP_PASSWORD=contrasena_de_aplicacion
SMTP_FROM=TrackPill <cuenta@gmail.com>
```
