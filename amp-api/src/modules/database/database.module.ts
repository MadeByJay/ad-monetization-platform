import { Global, Module } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { Repositories } from '../../repositories/repositories';
import type { Database } from '../../types/database';

@Global()
@Module({
  providers: [
    {
      provide: 'DB',
      useFactory: async () => {
        const pool = new pg.Pool({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: Number(process.env.POSTGRES_PORT || 5432),
          database: process.env.POSTGRES_DB || 'adsim',
          user: process.env.POSTGRES_USER || 'adsim',
          password: process.env.POSTGRES_PASSWORD || 'adsim',
          max: 10,
        });

        const db = new Kysely<Database>({
          dialect: new PostgresDialect({ pool }),
        });

        //Core domain
        await sql`CREATE TABLE IF NOT EXISTS campaigns(
          id uuid PRIMARY KEY,
          name text NOT NULL,
          priority integer NOT NULL,
          cpm_bid numeric NOT NULL,
          daily_budget numeric NOT NULL,
          pacing_strategy text NOT NULL,
          freq_cap_user_day integer NOT NULL,
          targeting_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          formats_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          active boolean NOT NULL DEFAULT true
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS creatives(
          id uuid PRIMARY KEY,
          campaign_id uuid NULL,
          line_item_id uuid NULL,
          type text NOT NULL,
          duration_sec integer,
          size text,
          brand_safety text,
          account_id uuid NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS scenarios(
          id uuid PRIMARY KEY,
          name text NOT NULL,
          config_json jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          account_id uuid NULL,
          created_by_user_id uuid NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS runs(
          id uuid PRIMARY KEY,
          scenario_id uuid NULL REFERENCES scenarios(id) ON DELETE SET NULL,
          started_at timestamptz NOT NULL DEFAULT now(),
          finished_at timestamptz,
          stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          account_id uuid NULL,
          created_by_user_id uuid NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS impressions(
          id uuid PRIMARY KEY,
          run_id uuid REFERENCES runs(id) ON DELETE CASCADE,
          slot_type text NOT NULL,
          ts timestamptz NOT NULL DEFAULT now(),
          campaign_id uuid NULL,
          creative_id uuid NULL,
          cpm numeric,
          revenue numeric,
          user_id text,
          context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          account_id uuid NULL
        );`.execute(db);

        //Dimensions + campaign_dim
        await sql`CREATE TABLE IF NOT EXISTS brands(
          id uuid PRIMARY KEY,
          name text UNIQUE NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS products(
          id uuid PRIMARY KEY,
          name text NOT NULL,
          brand_id uuid REFERENCES brands(id) ON DELETE CASCADE
        );`.execute(db);

        await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_products_brand_name ON products(brand_id, name);`.execute(
          db,
        );

        await sql`CREATE TABLE IF NOT EXISTS studios(
          id uuid PRIMARY KEY,
          name text UNIQUE NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS movies(
          id uuid PRIMARY KEY,
          title text NOT NULL,
          studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,
          release_date date
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS campaign_dim(
          campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
          brand_id uuid NULL REFERENCES brands(id),
          product_id uuid NULL REFERENCES products(id),
          studio_id uuid NULL REFERENCES studios(id),
          movie_id uuid NULL REFERENCES movies(id)
        );`.execute(db);

        // Normalize campaign_dim (PK, nullable pairs, integrity check)
        await sql`ALTER TABLE campaign_dim DROP CONSTRAINT IF EXISTS campaign_dim_pkey;`.execute(
          db,
        );

        await sql`ALTER TABLE campaign_dim DROP CONSTRAINT IF EXISTS campaign_dim_pk;`.execute(
          db,
        );

        await sql`ALTER TABLE campaign_dim
          ALTER COLUMN brand_id DROP NOT NULL,
          ALTER COLUMN product_id DROP NOT NULL,
          ALTER COLUMN studio_id DROP NOT NULL,
          ALTER COLUMN movie_id DROP NOT NULL;`.execute(db);

        const pkCheck = await sql`
          SELECT conname FROM pg_constraint
          WHERE conrelid='campaign_dim'::regclass AND contype='p'
        `.execute(db);

        if (!((pkCheck as any).rows?.length > 0)) {
          await sql`ALTER TABLE campaign_dim ADD CONSTRAINT campaign_dim_pk PRIMARY KEY (campaign_id);`.execute(
            db,
          );
        }

        await sql`ALTER TABLE campaign_dim DROP CONSTRAINT IF EXISTS campaign_dim_valid_pair;`.execute(
          db,
        );

        await sql`ALTER TABLE campaign_dim
          ADD CONSTRAINT campaign_dim_valid_pair
          CHECK(
            (brand_id IS NOT NULL AND product_id IS NOT NULL AND studio_id IS NULL AND movie_id IS NULL)
            OR
            (studio_id IS NOT NULL AND movie_id IS NOT NULL AND brand_id IS NULL AND product_id IS NULL)
          );`.execute(db);

        await sql`CREATE INDEX IF NOT EXISTS idx_campaign_dim_brand   ON campaign_dim(brand_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_campaign_dim_product ON campaign_dim(product_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_campaign_dim_studio  ON campaign_dim(studio_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_campaign_dim_movie   ON campaign_dim(movie_id);`.execute(
          db,
        );

        //Inventory
        await sql`CREATE TABLE IF NOT EXISTS networks(
          id uuid PRIMARY KEY, name text NOT NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS channels(
          id uuid PRIMARY KEY, network_id uuid REFERENCES networks(id) ON DELETE CASCADE, name text NOT NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS services(
          id uuid PRIMARY KEY, name text NOT NULL, type text NOT NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS series(
          id uuid PRIMARY KEY, studio_id uuid NULL REFERENCES studios(id) ON DELETE SET NULL, title text NOT NULL, genre text, rating text
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS seasons(
          id uuid PRIMARY KEY, series_id uuid REFERENCES series(id) ON DELETE CASCADE, number integer NOT NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS episodes(
          id uuid PRIMARY KEY, season_id uuid REFERENCES seasons(id) ON DELETE CASCADE, number integer NOT NULL, duration_sec integer
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS event_series(
          id uuid PRIMARY KEY, studio_id uuid NULL REFERENCES studios(id) ON DELETE SET NULL, name text NOT NULL, sport_or_kind text
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS event_occurrences(
          id uuid PRIMARY KEY, event_series_id uuid REFERENCES event_series(id) ON DELETE CASCADE, starts_at timestamptz NOT NULL, venue text, duration_sec integer
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS ad_pods(
          id uuid PRIMARY KEY, content_type text NOT NULL, content_id uuid NOT NULL, at_sec integer, pod_type text NOT NULL, max_duration_sec integer
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS pod_slots(
          id uuid PRIMARY KEY, ad_pod_id uuid REFERENCES ad_pods(id) ON DELETE CASCADE, position integer NOT NULL, duration_sec integer NOT NULL
        );`.execute(db);

        await sql`CREATE INDEX IF NOT EXISTS idx_channels_network ON channels(network_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_seasons_series  ON seasons(series_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_events_series   ON event_occurrences(event_series_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_pods_content    ON ad_pods(content_type, content_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_slots_pod       ON pod_slots(ad_pod_id);`.execute(
          db,
        );

        //Demand
        await sql`CREATE TABLE IF NOT EXISTS insertion_orders(
          id uuid PRIMARY KEY,
          name text NOT NULL,
          advertiser text NOT NULL,
          start_date date NOT NULL,
          end_date date NOT NULL,
          budget_total numeric NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          account_id uuid NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS line_items(
          id uuid PRIMARY KEY,
          io_id uuid REFERENCES insertion_orders(id) ON DELETE CASCADE,
          name text NOT NULL,
          start_dt timestamptz NOT NULL,
          end_dt timestamptz NOT NULL,
          budget numeric NOT NULL,
          cpm_bid numeric NOT NULL DEFAULT 15,
          pacing_strategy text NOT NULL,
          targeting_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          caps_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          floors_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          account_id uuid NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS category_exclusions(
          id uuid PRIMARY KEY, line_item_id uuid REFERENCES line_items(id) ON DELETE CASCADE, category text NOT NULL
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS competitive_separation(
          id uuid PRIMARY KEY, line_item_id uuid REFERENCES line_items(id) ON DELETE CASCADE, category text NOT NULL, min_separation_min integer NOT NULL
        );`.execute(db);

        await sql`CREATE INDEX IF NOT EXISTS idx_line_items_io    ON line_items(io_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_line_items_dates ON line_items(start_dt, end_dt);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_excl_li          ON category_exclusions(line_item_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_compsep_li       ON competitive_separation(line_item_id);`.execute(
          db,
        );

        await sql`ALTER TABLE line_items ADD COLUMN IF NOT EXISTS cpm_bid numeric NOT NULL DEFAULT 15;`.execute(
          db,
        );

        await sql`ALTER TABLE creatives  ADD COLUMN IF NOT EXISTS line_item_id uuid NULL REFERENCES line_items(id) ON DELETE SET NULL;`.execute(
          db,
        );

        //Rollups & indexes
        await sql`CREATE TABLE IF NOT EXISTS run_rollups(
          id uuid PRIMARY KEY,
          run_id uuid UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
          generated_at timestamptz NOT NULL DEFAULT now(),
          spend_over_time_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          top_facets_json jsonb NOT NULL DEFAULT '{}'::jsonb
        );`.execute(db);

        await sql`CREATE INDEX IF NOT EXISTS idx_impressions_run  ON impressions(run_id);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_impressions_slot ON impressions(slot_type);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_impressions_ts   ON impressions(ts);`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_network ON impressions ((context_json->'content'->>'network_id'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_channel ON impressions ((context_json->'content'->>'channel_id'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_series  ON impressions ((context_json->'content'->>'series_id'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_episode ON impressions ((context_json->'content'->>'episode_id'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_service ON impressions ((context_json->'content'->>'service_id'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_genre   ON impressions ((context_json->'content'->>'genre'));`.execute(
          db,
        );

        await sql`CREATE INDEX IF NOT EXISTS idx_imp_content_rating  ON impressions ((context_json->'content'->>'rating'));`.execute(
          db,
        );

        // Org & Auth + backfill (always runs)
        await sql`CREATE TABLE IF NOT EXISTS accounts(
          id uuid PRIMARY KEY,
          name text NOT NULL,
          slug text UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now()
        );`.execute(db);

        await sql`CREATE TABLE IF NOT EXISTS users(
          id uuid PRIMARY KEY,
          email text UNIQUE NOT NULL,
          name text,
          password_hash text,
          image_url text,
          created_at timestamptz NOT NULL DEFAULT now()
        );`.execute(db);

        // Portable enum creation (no IF NOT EXISTS)
        const orgRoleType =
          await sql`SELECT 1 FROM pg_type WHERE typname='org_role'`.execute(
            db,
          );
        if (!((orgRoleType as any).rows?.length > 0)) {
          await sql`CREATE TYPE org_role AS ENUM ('owner','admin','sales','trafficker','analyst','viewer')`.execute(
            db,
          );
        }

        await sql`CREATE TABLE IF NOT EXISTS memberships(
          user_id uuid REFERENCES users(id) ON DELETE CASCADE,
          account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
          role org_role NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, account_id)
        );`.execute(db);

        // Ensure default account and demo user exist (idempotent)
        let accountId: string | undefined;
        let userId: string | undefined;

        const accRes =
          await sql`SELECT id FROM accounts WHERE slug='default'`.execute(db);

        if ((accRes as any).rows?.length > 0) {
          accountId = (accRes as any).rows[0].id;
        } 
        else {
          accountId = crypto.randomUUID();
          await sql`INSERT INTO accounts(id, name, slug) VALUES (${accountId}, 'Demo Org', 'default')`.execute(
            db,
          );
        }

        const userRes =
          await sql`SELECT id FROM users WHERE email='demo@amp.local'`.execute(
            db,
          );

        if ((userRes as any).rows?.length > 0) {
          userId = (userRes as any).rows[0].id;
        } 
        else {
          userId = crypto.randomUUID();
          const bcryptModule = await import('bcryptjs');
          const bcryptLib: any = (bcryptModule as any).default ?? bcryptModule;
          const hash = await bcryptLib.hash('demo123', 12);
          await sql`INSERT INTO users(id, email, name, password_hash) VALUES (${userId}, 'demo@amp.local', 'Demo User', ${hash})`.execute(
            db,
          );
        }

        const memRes =
          await sql`SELECT 1 FROM memberships WHERE user_id=${userId} AND account_id=${accountId}`.execute(
            db,
          );

        if (!((memRes as any).rows?.length > 0)) {
          await sql`INSERT INTO memberships(user_id, account_id, role) VALUES (${userId}, ${accountId}, 'owner'::org_role)`.execute(
            db,
          );
        }

        // console.log('account id bro', accountId);
        // // Backfill ALWAYS: set account_id (and created_by_user_id where present) on NULL rows
        // await sql`UPDATE scenarios        SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE runs             SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE impressions      SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE insertion_orders SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE line_items       SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE creatives        SET account_id=${accountId} WHERE account_id IS NULL`.execute(
        //   db,
        // );

        // // Optionally stamp created_by_user_id where missing (scenarios/runs)
        // await sql`UPDATE scenarios SET created_by_user_id=${userId} WHERE created_by_user_id IS NULL`.execute(
        //   db,
        // );
        // await sql`UPDATE runs      SET created_by_user_id=${userId} WHERE created_by_user_id IS NULL`.execute(
        //   db,
        // );

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
