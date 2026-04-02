# Sportz

Real-time sports backend built with Express, PostgreSQL (Drizzle ORM), and WebSockets.

The project currently contains a complete backend in `Server/` and an empty frontend placeholder in `Client/`.

## Features

- REST API for matches and commentary
- WebSocket pub/sub for match-specific updates
- Input validation with Zod
- Arcjet security middleware for HTTP and WebSocket traffic
- Drizzle ORM + PostgreSQL schema/migrations
- APM Insight agent bootstrap in server startup

## Project Structure

```text
Sportz/
  Client/              # Frontend placeholder (currently empty)
  Server/
    src/
      app.js           # Express + HTTP server bootstrap
      ws/server.js     # WebSocket server and pub/sub logic
      routes/          # API route definitions
      controllers/     # Request validation + response shaping
      services/        # Business/data-access logic
      db/              # Drizzle DB client and schema
      middleware/      # Arcjet HTTP/WS middleware
      validation/      # Zod schemas
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL database (Neon or local PostgreSQL)

## Setup

1. Install dependencies:

```bash
cd Server
npm install
```

2. Configure environment variables:

Create/update `Server/.env`:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<HOST>:<PORT>/<DB_NAME>?sslmode=verify-full&channel_binding=require
ARCJET_KEY=<your_arcjet_key>
ARCJET_ENV=development
BASE_URL=https://sportz-sigma.vercel.app
```

Notes:
- `ARCJET_ENV=development` runs Arcjet in DRY_RUN mode in this project.
- WebSocket bot rule is enforced only in `LIVE` mode.
- `NODE_ENV=development` makes the app use localhost URLs for startup logs.
- In non-development environments, the app uses `BASE_URL` (for example, your deployed URL).

3. Run migrations (if needed):

```bash
npm run db:migrate
```

4. Start the development server:

```bash
npm run dev
```

Expected startup logs:
- `Server running on http://localhost:3000`
- `WebSocket server running on ws://0.0.0.0:3000/ws`

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Health

- `GET /`

### Matches

- `GET /matches?limit=50`
- `POST /matches`

Example `POST /matches` body:

```json
{
  "sport": "Football",
  "homeTeam": "Team A",
  "awayTeam": "Team B",
  "startTime": "2026-04-02T12:00:00.000Z",
  "endTime": "2026-04-02T14:00:00.000Z",
  "homeScore": 0,
  "awayScore": 0
}
```

### Commentary

- `GET /matches/:id/commentary?limit=100`
- `POST /matches/:id/commentary`

Example `POST /matches/1/commentary` body:

```json
{
  "minute": 42,
  "sequence": 1,
  "period": "H2",
  "eventType": "goal",
  "actor": "Alex Morgan",
  "team": "FC Neon",
  "message": "GOAL! Powerful finish from the edge of the box.",
  "metadata": { "assist": "Sam Kerr" },
  "tags": ["goal", "shot"]
}
```

Important: use `minute` (not `minutes`).

## WebSocket

Endpoint:

- `ws://localhost:3000/ws`

Connect using:

```bash
wscat -c ws://localhost:3000/ws
```

### Subscribe to a match

```json
{"type":"subscribe","matchId":1}
```

### Unsubscribe from a match

```json
{"type":"unsubscribe","matchId":1}
```

### Server events

- `WebSocket_server_created` (on connect)
- `client_joined` (broadcast when a client connects)
- `subscribed_to_match`
- `unsubscribed_from_match`
- `match_created_at` (for subscribers of that match)
- `commentary_update` (for subscribers of that match)

## Response Format

Most responses use:

```json
{
  "payload": {
    "success": true,
    "error": null,
    "data": {}
  }
}
```

Validation failures return `success: false` and issue details in `data`.

## Common Troubleshooting

### 1) Match/commentary insert fails with "Internal server error"

If error details mention DNS/host resolution like `EAI_AGAIN`, your database host is unreachable from your machine/network.

Checklist:
- Verify `DATABASE_URL` host/user/password
- Confirm internet/DNS access to your DB host
- Try a local PostgreSQL URL temporarily to isolate network issues

### 2) Arcjet warnings in local development

- Keep `ARCJET_ENV=development` for local runs
- In this project, WebSocket detectBot is only active in `LIVE`

### 3) WebSocket connected but no update received

- Ensure you sent a valid subscribe message
- Ensure `matchId` is an integer
- Ensure your subscription `matchId` matches the event `match.id`

## Scripts (Server)

- `npm run dev` - Start dev server with nodemon
- `npm start` - Start server
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run migrations

## Next Steps

- Build frontend in `Client/` to consume REST + WebSocket streams
- Add automated tests for controllers/services/ws flows
- Add structured logging for DB and WebSocket diagnostics
