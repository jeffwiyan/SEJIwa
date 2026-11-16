# SEJIWA

SEJIWA (Sejahtera Jiwa, Wadah Aman) is a TypeScript/React web app with an Express API and a persistent SQLite database. The existing public site and role-specific portals are connected to the API for authentication, profile updates, education content, private counseling messages, complaint tracking, notifications, and administrative account/content management.

> **Demonstration environment:** sample psychologist profiles and articles are illustrative only. Provider credentials and service availability have not been verified. This app is not a diagnosis, clinical service, or emergency service.

## Requirements

- Node.js 22.5 or newer (uses the built-in `node:sqlite` module)
- npm

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and set a unique password of at least 12 characters for each demo role you need. Demo accounts are only created when both their email and password are set. Then start the app:

```powershell
npm run dev
```

Open `http://localhost:3000`. To use only the employee portal, register an employee account from the public sign-up form; no demo account is required.

### Demo accounts

The email addresses are configurable in `.env.local`:

| Role | Default email |
|---|---|
| Employee | `employee.demo@sejiwa.local` |
| Psychologist | `psychologist.demo@sejiwa.local` |
| Case manager | `casemanager.demo@sejiwa.local` |
| Admin | `admin.demo@sejiwa.local` |

Set `DEMO_<ROLE>_PASSWORD` to a password of at least 12 characters. Passwords are read from the environment and hashed with scrypt before being stored. Do not reuse these demonstration credentials in production. The demo psychologist account is linked to the first illustrative profile.

## Build and start

```powershell
npm run lint
npm test
npm run build
npm start
```

`npm start` serves the production bundle and API on port `3000` (or `PORT`). Use HTTPS in production; the session cookie is marked `Secure` when `--production` is used.

## Persistence and API

- SQLite database path: `DATABASE_PATH` (default `./data/sejiwa.sqlite`).
- Initial schema is applied through versioned SQL migrations in `server/migrations/`.
- Passwords use Node's scrypt; sessions use random opaque tokens stored as hashes in SQLite and an HttpOnly, SameSite=Lax cookie.
- Mutating requests are same-origin checked; the API does not enable cross-origin access.
- API endpoints include `/api/auth/*`, `/api/bootstrap`, `/api/profile`, `/api/content`, `/api/complaints`, `/api/conversations`, `/api/notifications`, and `/api/admin/*`.
- Employee complaint and conversation queries are scoped to their account. Case managers can see only assigned complaints. Admin APIs expose aggregate complaint counts, not report text or private counseling conversations.
- Chat updates are fetched by the application every 15 seconds while signed in; messaging is not WebSocket real-time.

## Operational limitations

- Password-reset tokens and outbound email are not configured.
- Email, SMS, and WhatsApp notifications are not configured; in-app notifications are stored and can be marked read.
- Counseling schedule booking/video sessions, clinical-provider credential verification, file uploads, and production service-provider onboarding are not implemented. Demo psychologist profiles cannot be treated as real practitioners.
- SQLite in this starter is not encrypted at rest. Configure protected storage, backups, HTTPS, a managed database, monitoring, retention/deletion rules, and a reviewed privacy/terms policy before handling real employee or clinical data.
- The in-memory login throttling is suitable only for a single-instance demonstration. Production deployment needs shared rate limiting and operational monitoring.

## Validation

The automated tests cover existing filtering/validation utilities and API flows for login/logout, role-based complaint ownership and status updates, scoped counseling messages, admin article publication, profile availability, and audit records.
