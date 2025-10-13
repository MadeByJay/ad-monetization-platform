import type { INestApplicationContext } from '@nestjs/common';
import { sql, type Insertable } from 'kysely';
import { Repositories } from '../repositories/repositories';
import type {
  CampaignsTable,
  CreativesTable,
  ScenariosTable,
} from '../types/database';
import {
  BRANDS,
  DEVICE_POOL,
  GEO_POOL,
  TAG_POOL,
  pickMany,
  pickOne,
  seededRandom,
  makeUuid,
} from './seed.utils';
import { AppModule } from 'src/app.module';

/**
 * Idempotent, scalable seed.
 * - Truncates tables (CASCADE) so you always start clean.
 * - Creates N campaigns (N = 8 * SEED_SCALE), each with display and/or video creatives.
 * - Adds a couple of scenarios for demos (article + video).
 *
 * Environment knobs:
 *   SEED_SCALE: integer multiplier (default 1)  -> campaigns = 8 * scale
 */
export async function seedWithApp(app: INestApplicationContext): Promise<void> {
  const repositories = app.get(Repositories);
  // Access the underlying Kysely DB to run TRUNCATE CASCADE
  const db = app.get<any>('DB');

  // 0 - Clean slate
  await sql`TRUNCATE TABLE impressions, runs, creatives, campaigns, scenarios RESTART IDENTITY CASCADE;`.execute(
    db,
  );

  // 1 - Parameters
  const scale = Math.max(1, Number(process.env.SEED_SCALE || 1));
  const totalCampaigns = 8 * scale;
  const random = seededRandom(1337 * scale);

  // 2 - Seed campaigns + creatives
  const campaigns: Insertable<CampaignsTable>[] = [];
  const creatives: Insertable<CreativesTable>[] = [];

  const formatCombos: Array<readonly ('preroll' | 'midroll' | 'display')[]> = [
    ['preroll', 'midroll'],
    ['display'],
    ['preroll', 'display'],
    ['midroll', 'display'],
    ['preroll', 'midroll', 'display'],
  ];

  for (let index = 0; index < totalCampaigns; index++) {
    const brand = pickOne(random, BRANDS);
    const id = makeUuid();
    const formats = pickOne(random, formatCombos);
    const priority = 1 + Math.floor(random() * 10); // 1..10
    const cpmBid = Number((1.5 + random() * 12).toFixed(2)); // ~1.5..13.5
    const dailyBudget = Number((50 + random() * 450).toFixed(2)); // ~50..500
    const pacing_strategy = random() < 0.6 ? 'even' : 'asap'; // bias to even
    const freqCap = 1 + Math.floor(random() * 4); // 1..4

    const targeting_json = {
      geo: pickMany(random, GEO_POOL, 3 + Math.floor(random() * 3)), // 3-5 geos
      device: pickMany(random, DEVICE_POOL, 1 + Math.floor(random() * 1)), // 1-2 devices
      contentTags: pickMany(random, TAG_POOL, 3 + Math.floor(random() * 3)), // 3-5 tags
    };

    const campaign: Insertable<CampaignsTable> = {
      id,
      name: `${brand} ${index + 1}`,
      priority,
      cpm_bid: cpmBid,
      daily_budget: dailyBudget,
      pacing_strategy: pacing_strategy as 'even' | 'asap',
      freq_cap_user_day: freqCap,
      targeting_json,
      formats_json: formats as any, // JSON array
      active: true,
    };
    campaigns.push(campaign);

    // Creatives: if video formats present, add a couple of video creatives
    const hasVideo = formats.includes('preroll') || formats.includes('midroll');
    if (hasVideo) {
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        type: 'video',
        duration_sec: 15,
        size: null,
        brand_safety: 'G',
      });
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        type: 'video',
        duration_sec: 30,
        size: null,
        brand_safety: 'PG',
      });
    }

    // If display format present, add display banners
    if (formats.includes('display')) {
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        type: 'display',
        duration_sec: null,
        size: '300x250',
        brand_safety: 'G',
      });
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        type: 'display',
        duration_sec: null,
        size: '728x90',
        brand_safety: 'G',
      });
    }
  }

  // Bulk insert via repositories
  for (const c of campaigns) await repositories.campaigns.create(c);
  for (const k of creatives) await repositories.creatives.create(k);

  // 3 - Scenarios (2 examples)
  const scenarios: Insertable<ScenariosTable>[] = [
    {
      id: makeUuid(),
      name: 'Tech Article — Display Heavy',
      config_json: {
        content: {
          kind: 'article',
          placements: [
            { slotType: 'display', position: 'top' },
            { slotType: 'display', position: 'sidebar' },
            { slotType: 'display', position: 'in-article-1' },
          ],
        },
        timeline: [],
        cohort: {
          geoWeights: { US: 0.55, CA: 0.1, IN: 0.2, GB: 0.1, AU: 0.05 },
          deviceWeights: { desktop: 0.6, mobile: 0.4 },
          contentTags: ['tech', 'news', 'gaming'],
        },
        lengthImpressions: 200 * scale,
      },
      created_at: undefined as never, // let DB default fill
    },
    {
      id: makeUuid(),
      name: 'News Video — Pre/Midroll',
      config_json: {
        content: {
          kind: 'video',
          placements: [
            { slotType: 'preroll', at: 0 },
            { slotType: 'midroll', at: 60 },
            { slotType: 'midroll', at: 120 },
          ],
        },
        timeline: [0, 60, 120],
        cohort: {
          geoWeights: { US: 0.6, CA: 0.1, GB: 0.1, DE: 0.1, IN: 0.1 },
          deviceWeights: { desktop: 0.5, mobile: 0.5 },
          contentTags: ['news', 'sports', 'entertainment'],
        },
        lengthImpressions: 150 * scale,
      },
      created_at: undefined as never,
    },
  ];

  for (const s of scenarios) {
    await repositories.scenarios.create(s);
  }
}

/**
 * Optional standalone entry (only if you run: node dist/data/seed.js)
 * Not used during normal server startup where we call seedWithApp(app).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any, module: any;
if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module
) {
  (async () => {
    const { NestFactory } = await import('@nestjs/core');
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    try {
      console.log('Seed starting');
      await seedWithApp(app);
      // eslint-disable-next-line no-console
      console.log('Seed completed');
    } finally {
      await app.close();
    }
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
