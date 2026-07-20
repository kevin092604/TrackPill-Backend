# TrackPill Backend

API Node.js + Express para TrackPill.

## Estructura

```text
src/
|-- config/
|   |-- db.js
|   `-- schema.sql
|-- controllers/
|   |-- auth.controller.js
|   |-- caregiver.controller.js
|   |-- dashboard.controller.js
|   |-- medicine.controller.js
|   |-- notification.controller.js
|   `-- relationship.controller.js
|-- jobs/
|   |-- check-overdue-doses.js
|   `-- generate-daily-doses.js
|-- middlewares/
|   |-- auth.middleware.js
|   |-- caregiver-patient.middleware.js
|   `-- loginLimiter.middleware.js
|-- models/
|   |-- caregiver-relationship.model.js
|   |-- email-credential.model.js
|   |-- invitation-token.model.js
|   |-- medicine.model.js
|   |-- notification.model.js
|   |-- pending-social-registration.model.js
|   |-- provider-type.model.js
|   |-- schedule.model.js
|   |-- session.model.js
|   |-- social-provider.model.js
|   |-- user.model.js
|   `-- verification-code.model.js
|-- routes/
|   |-- auth.routes.js
|   |-- caregiver.routes.js
|   |-- dashboard.routes.js
|   |-- medicine.routes.js
|   |-- notification.routes.js
|   `-- relationship.routes.js
|-- services/
|   |-- auth.service.js
|   |-- dashboard.service.js
|   |-- email.service.js
|   |-- inventory.service.js
|   |-- medicine.service.js
|   |-- notification.service.js
|   |-- relationship.service.js
|   `-- social-provider.service.js
|-- utils/
|   `-- helpers.js
`-- app.js
```

## Configuración

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

## Endpoint solicitar recuperación de contraseña

`POST /auth/forgot-password`

Genera un codigo de 6 digitos, lo almacena como `forgotten_password` con
expiracion de 10 minutos y lo envia al correo registrado.

```json
{
  "email": "usuario@example.com"
}
```

## Endpoint reenviar código de verificación

`POST /auth/resend-email-verification`

Genera un nuevo codigo de 6 digitos para un usuario pendiente de verificacion,
marca como usados los codigos anteriores y envia el nuevo codigo por correo con
expiracion de 10 minutos.

```json
{
  "email": "usuario@example.com"
}
```

## Restablecer contraseña

`POST /auth/reset-password`

Recibe el `resetToken` devuelto por `/auth/verify-code` y la nueva contrasena.
Valida las reglas de seguridad, actualiza el hash y revoca las sesiones activas.

```json
{
  "resetToken": "jwt-temporal",
  "password": "NuevaClave1!"
}
```

## Endpoint resumen diario de paciente

`GET /dashboard/patient/summary`

Calcula y retorna para el paciente autenticado: el total de dosis programadas, completadas y pendientes del día; el conteo de medicamentos activos (stock > 0); la información de la próxima dosis pendiente (medicamento, hora programada y cantidad); y el historial de adherencia de los últimos 7 días (lunes a domingo) para el gráfico semanal. Requiere token Bearer de autenticación en el header `Authorization`.

### Ejemplo de respuesta exitosa (200 OK)

```json
{
  "success": true,
  "summary": {
    "today": {
      "scheduled": 5,
      "completed": 3,
      "pending": 2
    },
    "activeMedicinesCount": 2,
    "nextDose": {
      "id": "1",
      "medicationName": "Losartán 50mg",
      "scheduledTime": "2026-07-18T23:59:00.000Z",
      "dose": "1 tableta"
    },
    "weeklyAdherence": [
      {
        "day": "Mon",
        "scheduled": 3,
        "completed": 3,
        "pending": 0,
        "percentage": 100
      },
      {
        "day": "Tue",
        "scheduled": 3,
        "completed": 2,
        "pending": 1,
        "percentage": 66.7
      },
      {
        "day": "Wed",
        "scheduled": 4,
        "completed": 4,
        "pending": 0,
        "percentage": 100
      },
      {
        "day": "Thu",
        "scheduled": 4,
        "completed": 2,
        "pending": 2,
        "percentage": 50
      },
      {
        "day": "Fri",
        "scheduled": 3,
        "completed": 3,
        "pending": 0,
        "percentage": 100
      },
      {
        "day": "Sat",
        "scheduled": 2,
        "completed": 2,
        "pending": 0,
        "percentage": 100
      },
      {
        "day": "Sun",
        "scheduled": 2,
        "completed": 1,
        "pending": 1,
        "percentage": 50
      }
    ]
  }
}
```

## Endpoint resumen de seguimiento para cuidador

`GET /dashboard/caregiver/summary`

Retorna, para cada paciente con relación activa y aceptada vinculado al cuidador autenticado, su estado de adherencia del día actual, su próxima dosis, su última actividad (toma de dosis), el inventario crítico y el cumplimiento semanal. Requiere token Bearer de autenticación en el header `Authorization`.

### Ejemplo de respuesta exitosa (200 OK)

```json
{
  "success": true,
  "patients": [
    {
      "id": "2",
      "firstName": "Angel",
      "lastName": "Blandin",
      "email": "angel.blandin@trackpill.com",
      "photoUrl": null,
      "relationshipLabel": "Amigo",
      "todayAdherence": {
        "scheduled": 5,
        "completed": 3,
        "pending": 2,
        "percentage": 60
      },
      "nextDose": {
        "medicationName": "Losartán 50mg",
        "scheduledTime": "2026-07-19T14:20:00.000Z",
        "dose": "1 tableta",
        "timeRemainingText": "En 2 horas"
      },
      "lastActivity": {
        "medicationName": "Acetaminofén 300 mg",
        "takenTime": "2026-07-19T11:30:00.000Z",
        "dose": "1 tableta",
        "timeAgoText": "Hace 30 minutos"
      },
      "criticalInventory": [
        {
          "id": "10",
          "name": "Acetaminofén 300 mg",
          "currentStock": 10,
          "pharmaceuticalForm": "tableta"
        }
      ],
      "weeklyCompliance": [
        { "day": "Mon", "status": "completed" },
        { "day": "Tue", "status": "completed" },
        { "day": "Wed", "status": "failed" },
        { "day": "Thu", "status": "completed" },
        { "day": "Fri", "status": "completed" },
        { "day": "Sat", "status": "none" },
        { "day": "Sun", "status": "none" }
      ],
      "weeklyCompliancePercentage": 88
    }
  ]
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

## Endpoint de obtener calendario del paciente

`GET /caregivers/patients/:patientId/calendar?month=YYYY-MM`

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

`GET /caregivers/patients/:patientId/doses?date=YYYY-MM-DD`

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

## Endpoint de Notificaciones del Usuario

`GET /notifications`

Retorna las notificaciones del usuario autenticado, ordenadas por fecha descendente. Incluye el tipo de notificación, mensaje, estado de lectura y las referencias necesarias para la navegación (paciente, medicamento o invitación). Requiere token Bearer de autenticación en el header `Authorization`.

### Ejemplo de respuesta exitosa (200 OK)

```json
{
  "success": true,
  "notifications": [
    {
      "id": "101",
      "type": "medication_reminder",
      "message": "Es hora de tomar 1 pastilla de Paracetamol (500mg).",
      "isRead": false,
      "createdAt": "2026-07-03T11:30:00Z",
      "references": {
        "medicineId": "10"
      }
    },
    {
      "id": "102",
      "type": "caregiver_invitation",
      "message": "Blandin te ha invitado a ser su cuidador.",
      "isRead": true,
      "createdAt": "2026-07-02T15:45:00Z",
      "references": {
        "invitationId": "5",
        "patientId": "1"
      }
    }
  ]
}
```

## Endpoints de Medicamentos (Medicines)

Todos los endpoints de este módulo requieren el token de acceso en la cabecera `Authorization: Bearer <token>`.

### Registrar medicamento

`POST /medicines`

Registra un nuevo medicamento con su respectiva dosificación, stock inicial, umbrales de alerta de inventario y la planificación horaria semanal.

**Ejemplo de Petición:**

```json
{
  "name": "Paracetamol 500mg",
  "pharmaceuticalFormId": 1,
  "currentStock": 30.0,
  "dose": 1.0,
  "frequency": 8,
  "timeUnitId": 1,
  "startTime": "08:00",
  "description": "Tomar después de las comidas",
  "lowStockAlertEnabled": true,
  "lowStockThreshold": 5.0,
  "schedule": {
    "monday": true,
    "wednesday": true,
    "friday": true
  }
}
```

**Ejemplo de Respuesta:**

```json
{
  "success": true,
  "medicine": {
    "id": "1",
    "name": "Paracetamol 500mg",
    "image": null,
    "pharmaceuticalFormId": 1,
    "currentStock": 30,
    "dose": 1,
    "frequency": 8,
    "timeUnitId": 1,
    "startTime": "08:00:00",
    "scheduleId": 2,
    "description": "Tomar después de las comidas",
    "lowStockAlertEnabled": true,
    "lowStockThreshold": 5,
    "userId": "1"
  }
}
```

### Obtener listado de medicamentos (con búsqueda)

`GET /medicines`

Obtiene todos los medicamentos registrados para el paciente autenticado. Soporta coincidencia parcial por nombre utilizando el parámetro de búsqueda `?search=texto`.

**Ejemplo de Petición:**
`GET /medicines?search=para`

**Ejemplo de Respuesta:**

```json
{
  "success": true,
  "medicines": [
    {
      "id": "1",
      "name": "Paracetamol 500mg",
      "image": null,
      "dose": 1,
      "frequency": 8,
      "timeUnit": "horas",
      "pharmaceuticalForm": "tableta",
      "currentStock": 30,
      "lowStockThreshold": 5,
      "lowStockAlertEnabled": true,
      "nextScheduledTime": "2026-07-19T08:00:00.000Z"
    }
  ]
}
```

### Obtener detalle completo de un medicamento

`GET /medicines/:id`

Devuelve el detalle de un medicamento específico del paciente autenticado, incluyendo su presentación, planificación semanal de horarios, estimación de días de stock restantes (`daysRemaining`) e historial de cumplimiento de la semana actual (`weeklyCompliance`).

**Ejemplo de Petición:**
`GET /medicines/1`

**Ejemplo de Respuesta:**

```json
{
  "success": true,
  "medicine": {
    "id": "1",
    "name": "Paracetamol 500mg",
    "image": null,
    "pharmaceuticalFormId": 1,
    "pharmaceuticalFormName": "tableta",
    "currentStock": 30,
    "dose": 1,
    "frequency": 8,
    "timeUnitId": 1,
    "timeUnitName": "horas",
    "startTime": "08:00:00",
    "scheduleId": 2,
    "description": "Tomar después de las comidas (Para el dolor)",
    "lowStockAlertEnabled": true,
    "lowStockThreshold": 5,
    "userId": "1",
    "schedule": {
      "startDate": null,
      "endDate": null,
      "monday": true,
      "tuesday": false,
      "wednesday": true,
      "thursday": false,
      "friday": true,
      "saturday": false,
      "sunday": false
    },
    "daysRemaining": 10,
    "weeklyCompliance": [
      { "day": "Lun", "status": "completed" },
      { "day": "Mar", "status": "none" },
      { "day": "Mié", "status": "completed" },
      { "day": "Jue", "status": "none" },
      { "day": "Vie", "status": "completed" },
      { "day": "Sáb", "status": "none" },
      { "day": "Dom", "status": "none" }
    ]
  }
}
```

## Endpoint editar medicamento

`PUT /medicines/:id`

Actualiza los datos de un medicamento existente. Valida de forma estricta que el medicamento pertenezca al usuario autenticado. Soporta actualizaciones parciales o totales (puedes enviar solo los campos que necesitas cambiar o el formulario completo).

Si se envían datos dentro del objeto `schedule`, también actualizará la planificación de días de la semana de manera dinámica.

### Ejemplo de Petición:

```json
{
  "name": "Losartán 100mg",
  "currentStock": 25,
  "dose": 1.5,
  "lowStockAlertEnabled": true,
  "lowStockThreshold": 5,
  "schedule": {
    "monday": true,
    "wednesday": true,
    "friday": true
  }
}
```


### Obtener disponibilidad en farmacias cercanas
`GET /medicines/:id/pharmacies`

Retorna la lista de farmacias reales más cercanas (dentro de un radio de 5km) basadas en latitud y longitud, con su respectivo precio y divisa de contingencia o reportado por crowd-sourcing (aislado por país).

**Ejemplo de Petición:**
`GET /medicines/1/pharmacies?lat=14.0818&lng=-87.2068`

**Ejemplo de Respuesta:**
```json
{
  "success": true,
  "pharmacies": [
    {
      "placeId": "mock_kielsa_1",
      "name": "Farmacias Kielsa",
      "latitude": 14.0838,
      "longitude": -87.2078,
      "address": "Bulevar Morazán, Tegucigalpa, Honduras",
      "countryCode": "HN",
      "price": 34.00,
      "currency": "HNL",
      "source": "estimated"
    },
    {
      "placeId": "mock_siman_2",
      "name": "Farmacias Simán",
      "latitude": 14.0788,
      "longitude": -87.2048,
      "address": "Colonia Palmira, Tegucigalpa, Honduras",
      "countryCode": "HN",
      "price": 46.00,
      "currency": "HNL",
      "source": "estimated"
    }
  ]
}
```

#### Descripción de propiedades de la respuesta:
* **`placeId`** (`string`): Identificador único de la farmacia provisto por OpenStreetMap o generado en el mock.
* **`name`** (`string`): Nombre de la farmacia.
* **`latitude`** (`number`): Latitud geográfica de la sucursal.
* **`longitude`** (`number`): Longitud geográfica de la sucursal.
* **`address`** (`string`): Dirección física de la sucursal.
* **`countryCode`** (`string`): Código ISO de dos letras del país de la farmacia. Valores posibles: `HN`, `SV`, `MX`, `GT`, etc.
* **`price`** (`number`): Precio calculado o consultado del medicamento.
* **`currency`** (`string`): Código de moneda local asociado al país. Valores posibles: `HNL`, `USD`, `MXN`, `GTQ`, etc.
* **`source`** (`string`): El origen del precio devuelto. Valores posibles:
  * **`real`**: Precio real cargado de forma directa para esa sucursal en particular.
  * **`crowd_sourced`**: Precio promedio calculado dinámicamente a partir de los reportes globales de otros usuarios en el mismo país.
  * **`estimated`**: Precio simulado por el algoritmo en base al precio semilla y el hash determinista de la farmacia (fallback).

## Tareas Programadas (Jobs)

### Generación diaria de dosis

El sistema cuenta con un script independiente de Node.js diseñado para ejecutarse una vez al día a través de tareas programadas de la infraestructura (como Linux `crontab`, Heroku Scheduler, AWS EventBridge, etc.). Su objetivo es pre-generar las dosis del día siguiente en la tabla `medicine_stock.medication_logs` en base a la planificación activa de los medicamentos de cada paciente (`medicine_stock.medicines` y `medicine_stock.schedules`).

Para ejecutar este job manualmente:

```bash
node src/jobs/generate-daily-doses.js
```

### Detección periódica de dosis atrasadas y omitidas

Este script independiente se ejecuta de forma periódica (por ejemplo, cada minuto) para evaluar las dosis pendientes de los pacientes.

- Transiciona a `Retrasada` si han transcurrido más de **10 minutos** desde su hora programada sin registrar toma.
- Transiciona a `Omitida` si han transcurrido más de **30 minutos**.
  En cada cambio de estado, busca a todos los cuidadores activos del paciente y genera las notificaciones de tipo `dosis_retrasada` o `dosis_omitida` correspondientes.

Para ejecutar este job manualmente:

```bash
node src/jobs/check-overdue-doses.js
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
