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

## Endpoint registro social complementario

`POST /auth/social-register`

Recibe el `registrationToken` devuelto por `/auth/social` y los campos faltantes
del usuario. Si el correo ya existe y fue verificado por el proveedor, vincula la
cuenta existente; si no existe, crea el usuario, vincula el proveedor y devuelve
un token de autenticacion.

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
