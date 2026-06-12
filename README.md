# Game Satisfaction Survey

A Typeform-like Next.js survey application for collecting game feedback, GM (Game Master) interest data, coupon delivery records, and administrator reporting.

## Features

The application provides an interactive survey interface, GM interest tracking, an authenticated admin dashboard, CSV export functionality, rating charts, coupon delivery tracking, and server-side validation for submitted survey answers.

## Getting Started

### Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | Node.js 18 or newer is required. |
| PostgreSQL | A Neon-hosted PostgreSQL database is supported and recommended. |
| Resend | Required only when coupon emails should be sent. |

### Installation

Clone the repository and install dependencies.

```bash
git clone <repository-url>
cd game-satisfaction-survey
npm install
```

Create a `.env.local` file with the required configuration.

```env
DATABASE_URL=your_postgresql_connection_string
NEON_PROJECT_ID=your_neon_project_id
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Required for admin access protection.
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_long_random_password

# Required for signed response ownership tokens.
RESPONSE_TOKEN_SECRET=replace_with_a_long_random_secret

# Optional. Must be explicitly enabled before destructive admin maintenance routes can run.
ENABLE_DANGEROUS_ADMIN_ACTIONS=false
```

The admin dashboard and all `/api/admin/*` routes fail closed unless `ADMIN_USERNAME` and `ADMIN_PASSWORD` are configured. Public follow-up mutations use signed response ownership tokens, so `RESPONSE_TOKEN_SECRET` must be stable across deployments. If this secret changes, users with an in-progress survey session may need to resubmit before follow-up coupon or GM-interest actions can complete.

### Database Setup

This application uses versioned SQL migrations under `migrations/`. Run all migrations against the target PostgreSQL database before deploying or starting the app in production.

```bash
for file in migrations/*.sql; do
  psql "$DATABASE_URL" -f "$file"
done
```

The application no longer creates, drops, or reshapes production tables at request time. If a route reports that the GM association schema is not ready, run the migrations rather than relying on runtime schema repair.

### Running Locally

Start the development server.

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000). The admin dashboard is available at `/admin` after authenticating with the configured admin credentials.

## Security and Operational Notes

The admin area is protected with Basic authentication middleware. This is intentionally simple and fail-closed; a production SSO or role-based identity provider can replace it later, but no admin or admin API route should be deployed without an authentication layer.

Destructive admin maintenance operations require both `ENABLE_DANGEROUS_ADMIN_ACTIONS=true` and a request confirmation header. This protects against accidental clicks and prevents these routes from running in normal production deployments.

Public survey update, GM-interest, coupon-delivery, and coupon-email routes require a signed response ownership token returned by the initial survey submission. Numeric response identifiers alone are not trusted as authorization.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server. |
| `npm run build` | Build the production application. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run the TypeScript compiler without emitting files. |
| `npm test` | Run the Vitest unit test suite. |
| `npm run check` | Run lint, typecheck, tests, and build as a combined verification gate. |

## Project Structure

| Path | Purpose |
|---|---|
| `app/` | Next.js app directory with pages and API routes. |
| `app/admin/` | Authenticated admin dashboard for viewing and maintaining survey data. |
| `app/api/` | Public survey endpoints and protected admin endpoints. |
| `lib/` | Database utilities, response-token helpers, validation utilities, and admin safety guards. |
| `migrations/` | Versioned PostgreSQL schema migrations. |
| `test/` | Focused unit tests for security and validation helpers. |

## Verification Before Deployment

Run the full verification gate before merging or deploying changes.

```bash
npm run check
npm audit --audit-level=moderate
```

At the time of this remediation pass, the dependency audit is expected to report zero moderate-or-higher vulnerabilities after `npm install` refreshes the lockfile.

## License

Private - Evil Genius Games
