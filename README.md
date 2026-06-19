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
- `Session`

Los proveedores sociales no se guardan embebidos en `User`; se vinculan mediante
`SocialProvider` y `ProviderType`.

En SQL se usan nombres plurales para evitar palabras reservadas:

- `users`
- `email_credentials`
- `verification_codes`
- `provider_types`
- `social_providers`
- `sessions`

## Endpoint social auth

`POST /auth/social`

Recibe una credencial de Google, Apple o Facebook, la verifica contra el proveedor,
busca si el usuario existe y responde una de estas acciones:

- `login_direct`: la cuenta ya estaba vinculada a ese proveedor.
- `linked_existing_account`: existe una cuenta con el mismo correo y se vinculo el proveedor.
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
