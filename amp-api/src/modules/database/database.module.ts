import { Module, Global, Logger } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import type { Database } from '../../types/database';
import { Repositories } from '../../repositories/repositories';

async function waitForPostgres(pool: pg.Pool, attempts = 20, delayMs = 500) {
  const logger = new Logger('DatabaseModule');

  for (let index = 1; index <= attempts; index++) {
    try {
      await pool.query('SELECT 1');
      logger.log(`Connected to Postgres on attempt ${index}`);
      return;
    } catch (error) {
      logger.warn(`Postgres not ready (attempt ${index}/${attempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Postgres not reachable after retries');
}

@Global()
@Module({
  providers: [
    {
      provide: 'DB',
      useFactory: async () => {
        const host = process.env.POSTGRES_HOST,
          port = process.env.POSTGRES_PORT,
          database = process.env.POSTGRES_DB,
          user = process.env.POSTGRES_USER,
          password = process.env.POSTGRES_PASSWORD;

        console.log(host, port, database, user, password);

        const pool = new pg.Pool({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: Number(process.env.POSTGRES_PORT || 5432),
          database: process.env.POSTGRES_DB || 'adsim',
          user: process.env.POSTGRES_USER || 'adsim',
          password: process.env.POSTGRES_PASSWORD || 'adsim',
          max: 10,
        });

        await waitForPostgres(pool);

        const db = new Kysely<Database>({
          dialect: new PostgresDialect({ pool }),
        });

        // Ensure schema…
        await sql`CREATE TABLE IF NOT EXISTS campaigns(
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          priority INTEGER NOT NULL,
          cpm_bid NUMERIC NOT NULL,
          daily_budget NUMERIC NOT NULL,
          pacing_strategy TEXT NOT NULL,
          freq_cap_user_day INTEGER NOT NULL,
          targeting_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          formats_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          active BOOLEAN NOT NULL DEFAULT true
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS creatives(
          id UUID PRIMARY KEY,
          campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          duration_sec INTEGER,
          size TEXT,
          brand_safety TEXT
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS scenarios(
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          config_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS runs(
          id UUID PRIMARY KEY,
          scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          finished_at TIMESTAMPTZ,
          stats_json JSONB NOT NULL DEFAULT '{}'::jsonb
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS impressions(
          id UUID PRIMARY KEY,
          run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
          slot_type TEXT NOT NULL,
          ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          campaign_id UUID,
          creative_id UUID,
          cpm NUMERIC,
          revenue NUMERIC,
          user_id TEXT,
          context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          trace_json JSONB NOT NULL DEFAULT '{}'::jsonb
        );`.execute(db);

        return db;
      },
    },
    {
      provide: Repositories,
      useFactory: (db: Kysely<Database>) => new Repositories(db),
      inject: ['DB'],
    },
  ],
  exports: ['DB', Repositories],
})
export class DatabaseModule {}
