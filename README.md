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

Edit `.env.local` only if you need explicitly configured demonstration accounts. No demo user or admin account is created by default. Users can register through the public form; administrators must be provisioned by the operator. Then start the app:

```powershell
npm run dev
```

Open `http://localhost:3000`. Register a user account to access psychologist discovery, private conversations, educational content, and complaint tracking.

### Administrator access

Use the **Administrator** sign-in tab. Admin self-registration is intentionally disabled. Provision an admin account by setting both variables in `.env.local` before starting the server:

```dotenv
DEMO_ADMIN_EMAIL=admin@your-company.example
DEMO_ADMIN_PASSWORD=replace-with-a-unique-password-of-at-least-12-characters
```

The configured admin account is created on first startup and refreshed from these values on later starts. Passwords are hashed with scrypt. Keep `.env.local` private and never use example/demo credentials in production. Psychologist and case-manager accounts can also be provisioned with their corresponding `DEMO_<ROLE>_EMAIL` and `DEMO_<ROLE>_PASSWORD` variables.

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
- User and administrator sign-in are separate in the UI and role-checked by the API. Public registration creates user accounts only.
- Password reset uses single-use, 30-minute tokens and invalidates existing sessions. In development the reset link is shown on screen. For production, configure `RESEND_API_KEY`, `PASSWORD_RESET_FROM`, and the HTTPS `APP_BASE_URL` to deliver reset links using Resend.
- API endpoints include `/api/auth/*`, `/api/bootstrap`, `/api/profile`, `/api/content`, `/api/complaints`, `/api/conversations`, `/api/notifications`, and `/api/admin/*`.
- Employee complaint and conversation queries are scoped to their account. Case managers can see only assigned complaints. Admin APIs expose aggregate complaint counts, not report text or private counseling conversations.
- Chat updates are fetched by the application every 15 seconds while signed in; messaging is not WebSocket real-time.

## Operational limitations

- Production password-reset email requires a configured Resend API key and verified sender address.
- Email, SMS, and WhatsApp notifications are not configured; in-app notifications are stored and can be marked read.
- Counseling schedule booking/video sessions, clinical-provider credential verification, file uploads, and production service-provider onboarding are not implemented. Demo psychologist profiles cannot be treated as real practitioners.
- SQLite in this starter is not encrypted at rest. Configure protected storage, backups, HTTPS, a managed database, monitoring, retention/deletion rules, and a reviewed privacy/terms policy before handling real employee or clinical data.
- The in-memory login throttling is suitable only for a single-instance demonstration. Production deployment needs shared rate limiting and operational monitoring.

## Validation

The automated tests cover user registration, separated user/admin login, one-time password reset and session invalidation, SQLite persistence and migrations, role-based complaint ownership and status updates, scoped counseling messages, admin article publication, profile availability, and audit records.
