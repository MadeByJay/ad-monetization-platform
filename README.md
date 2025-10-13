# Ad Tech / Monetization Simulator 

## Quick start (Docker)

```bash
cp .env.example .env   # optional
docker compose up --build
```

- UI: http://localhost:3000
- API: http://localhost:3001/api
- Metrics: http://localhost:3001/api/metrics
- Postgres: localhost:5432 (adsim / adsim / adsim)

The API seeds a few campaigns and creatives when `SEED_ON_START=true`.

## Packages

- `amp-api`: Node server that exposes simulation endpoints and talks to Postgres (Kysely) and Redis.
- `amp-ui`: Next.js App Router app with Backend for Frontend route handlers under `app/api/*`.

## Notes
- Swagger - I just like the name