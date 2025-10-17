import type { INestApplicationContext } from '@nestjs/common';
import type { Insertable } from 'kysely';
import { Repositories } from '../repositories/repositories';
import type {
  CampaignsTable,
  CreativesTable,
  ScenariosTable,
} from '../types/database';
import {
  seededRandom,
  pickOne,
  pickMany,
  makeUuid,
  GEO_POOL,
  DEVICE_POOL,
  TAG_POOL,
  BRAND_NAMES,
  STUDIO_NAMES,
  pickInt,
  range,
} from './seed.utils';
import { AppModule } from 'src/app.module';

/**
 * Idempotent seed tied to the Default account + Demo user.
 * - Brands (10) + Products (5–7 each) (upsert by name / (brand_id,name))
 * - Studios (6) + Movies (3–5 each) (upsert studios by name)
 * - Inventory (networks/channels/services/series/seasons/episodes/events/pods/slots)
 * - Campaigns & Creatives (still present for now; creatives stamped with account_id)
 * - Scenarios (stamped with account/user)
 * - IO / Line Items / Policy (stamped with account_id)
 */
export async function seedWithApp(app: INestApplicationContext): Promise<void> {
  const repositories = app.get(Repositories);
  const db: any = app.get('DB');

  // Resolve Default account and Demo user
  const defaultAccount = await db
    .selectFrom('accounts')
    .select(['id'])
    .where('slug', '=', 'default')
    .executeTakeFirst();

  if (!defaultAccount)
    throw new Error('Default account missing (boot DDL should create it)');

  const accountId = defaultAccount.id as string;

  const demoUser = await db
    .selectFrom('users')
    .select(['id'])
    .where('email', '=', 'demo@amp.local')
    .executeTakeFirst();

  if (!demoUser)
    throw new Error('Demo user missing (boot DDL should create it)');
  const demoUserId = demoUser.id as string;

  // Truncate only data we strictly own (OPTIONAL). Comment these if you prefer additive seeds.
  // await db.executeQuery({ sql: `TRUNCATE TABLE impressions, runs, campaign_dim, creatives, campaigns, scenarios, movies, products, studios, brands, networks, channels, services, series, seasons, episodes, event_occurrences, event_series, ad_pods, pod_slots RESTART IDENTITY CASCADE;`, parameters: [] })

  const scale = Math.max(1, Number(process.env.SEED_SCALE || 1));
  const rand = seededRandom(1337 * scale);

  // Brands (upsert by name) & Products (idempotent) 
  const desiredBrandNames = (
    BRAND_NAMES ?? [
      'Acme',
      'Globex',
      'Initech',
      'Umbrella',
      'Soylent',
      'Vandelay',
      'Stark',
      'Wayne',
      'Wonka',
      'Tyrell',
    ]
  ).slice(0, 10);

  const existingBrandRows = await db
    .selectFrom('brands')
    .select(['id', 'name'])
    .where('name', 'in', desiredBrandNames as any)
    .execute();

  const brandNameToId = new Map<string, string>(
    existingBrandRows.map((b: any) => [b.name, b.id]),
  );

  const brandsToInsert = desiredBrandNames
    .filter((n) => !brandNameToId.has(n))
    .map((n) => ({ id: makeUuid(), name: n }));

  if (brandsToInsert.length) {
    const insertedBrands = await db
      .insertInto('brands')
      .values(brandsToInsert)
      .onConflict((oc: any) => oc.column('name').doNothing())
      .returning(['id', 'name'])
      .execute();
    for (const row of insertedBrands) brandNameToId.set(row.name, row.id);
  }

  const brandRows = desiredBrandNames.map((name) => ({
    id: brandNameToId.get(name)!,
    name,
  }));

  const existingProducts = await db
    .selectFrom('products')
    .select(['id', 'name', 'brand_id'])
    .where('brand_id', 'in', brandRows.map((b) => b.id) as any)
    .execute();
  const existingProductKey = new Set(
    existingProducts.map((p: any) => `${p.brand_id}::${p.name}`),
  );

  const productRows: Array<{ id: string; name: string; brand_id: string }> = [];
  for (const brand of brandRows) {
    const count = pickInt(rand, 5, 7);
    for (let i = 1; i <= count; i++) {
      const name = `${brand.name} Product ${i}`;
      const key = `${brand.id}::${name}`;
      if (!existingProductKey.has(key)) {
        productRows.push({ id: makeUuid(), name, brand_id: brand.id });
        existingProductKey.add(key);
      }
    }
  }
  if (productRows.length) {
    await db
      .insertInto('products')
      .values(productRows)
      .onConflict((oc: any) => oc.columns(['brand_id', 'name']).doNothing())
      .execute();
  }

  // Studios (upsert by name) & Movies 
  const desiredStudioNames = (
    STUDIO_NAMES ?? [
      'Aquila',
      'Northstar',
      'Nimbus',
      'Meridian',
      'Harbor',
      'Catalyst',
    ]
  ).slice(0, 6);

  const existingStudioRows = await db
    .selectFrom('studios')
    .select(['id', 'name'])
    .where('name', 'in', desiredStudioNames as any)
    .execute();
    
  const studioNameToId = new Map<string, string>(
    existingStudioRows.map((s: any) => [s.name, s.id]),
  );
  
  const studiosToInsert = desiredStudioNames
    .filter((n) => !studioNameToId.has(n))
    .map((n) => ({ id: makeUuid(), name: n }));
    
  if (studiosToInsert.length) {
    const insertedStudios = await db
      .insertInto('studios')
      .values(studiosToInsert)
      .onConflict((oc: any) => oc.column('name').doNothing())
      .returning(['id', 'name'])
      .execute();
    for (const row of insertedStudios) studioNameToId.set(row.name, row.id);
  }
  const studioRows = desiredStudioNames.map((name) => ({
    id: studioNameToId.get(name)!,
    name,
  }));

  const movieRows: Array<{
    id: string;
    title: string;
    studio_id: string;
    release_date: string | null;
  }> = [];
  for (const s of studioRows) {
    const count = pickInt(rand, 3, 5);
    
    for (let i = 1; i <= count; i++) {
      movieRows.push({
        id: makeUuid(),
        title: `${s.name} Movie ${i}`,
        studio_id: s.id,
        release_date: null,
      });
    }
  }
  
  if (movieRows.length)
    await db.insertInto('movies').values(movieRows).execute();

  // Inventory (networks/services/series/…/pods)
  const networks = [
    { id: makeUuid(), name: 'WBD Sports' },
    { id: makeUuid(), name: 'WBD News' },
    { id: makeUuid(), name: 'WBD Entertainment' },
  ];

  await db.insertInto('networks').values(networks).execute();

  const channels = [
    { id: makeUuid(), network_id: networks[0].id, name: 'Sports One' },
    { id: makeUuid(), network_id: networks[0].id, name: 'Sports Plus' },
    { id: makeUuid(), network_id: networks[1].id, name: 'News 24' },
    { id: makeUuid(), network_id: networks[2].id, name: 'Drama HD' },
    { id: makeUuid(), network_id: networks[2].id, name: 'Comedy HD' },
  ];

  await db.insertInto('channels').values(channels).execute();

  const services = [
    { id: makeUuid(), name: 'StreamX', type: 'AVOD' },
    { id: makeUuid(), name: 'FreeX FAST', type: 'FAST' },
  ];

  await db.insertInto('services').values(services).execute();

  const studioIdOrNull = (i: number) =>
    studioRows.length ? studioRows[i % studioRows.length].id : null;

  const seriesRows = [
    {
      id: makeUuid(),
      studio_id: studioIdOrNull(0),
      title: 'Galactic Quest',
      genre: 'Sci-Fi',
      rating: 'TV-14',
    },
    {
      id: makeUuid(),
      studio_id: studioIdOrNull(1),
      title: 'City Beat',
      genre: 'Crime',
      rating: 'TV-MA',
    },
    {
      id: makeUuid(),
      studio_id: studioIdOrNull(2),
      title: 'Laugh Lane',
      genre: 'Comedy',
      rating: 'TV-PG',
    },
  ];

  await db.insertInto('series').values(seriesRows).execute();

  const seasonRows: any[] = [];
  const episodeRows: any[] = [];

  //TODO - Refactor this algo
  for (const s of seriesRows) {
    for (const seasonNumber of [1, 2]) {
      const seasonId = makeUuid();

      seasonRows.push({ id: seasonId, series_id: s.id, number: seasonNumber });

      for (let ep = 1; ep <= 5; ep++) {
        episodeRows.push({
          id: makeUuid(),
          season_id: seasonId,
          number: ep,
          duration_sec: 22 * 60,
        });
      }
    }
  }

  if (seasonRows.length)
    await db.insertInto('seasons').values(seasonRows).execute();

  if (episodeRows.length)
    await db.insertInto('episodes').values(episodeRows).execute();

  const firstStudioId = studioRows.length ? studioRows[0].id : null;

  const eventSeriesRows = [
    {
      id: makeUuid(),
      studio_id: firstStudioId,
      name: 'Pro Basketball 2025',
      sport_or_kind: 'Basketball',
    },
  ];

  await db.insertInto('event_series').values(eventSeriesRows).execute();

  const eventOccurrencesRows = Array.from({ length: 3 }).map((_, i) => ({
    id: makeUuid(),
    event_series_id: eventSeriesRows[0].id,
    starts_at: new Date(Date.now() + i * 86400000).toISOString(),
    venue: `Arena ${i + 1}`,
    duration_sec: 2 * 60 * 60,
  }));

  await db
    .insertInto('event_occurrences')
    .values(eventOccurrencesRows)
    .execute();

  const podRows: any[] = [];
  const slotRows: any[] = [];

  function seedPodsForEpisode(epId: string) {
    const prerollId = makeUuid();

    podRows.push({
      id: prerollId,
      content_type: 'episode',
      content_id: epId,
      at_sec: 0,
      pod_type: 'preroll',
      max_duration_sec: 120,
    });

    slotRows.push({
      id: makeUuid(),
      ad_pod_id: prerollId,
      position: 1,
      duration_sec: 15,
    });

    slotRows.push({
      id: makeUuid(),
      ad_pod_id: prerollId,
      position: 2,
      duration_sec: 15,
    });

    for (const mid of [7 * 60, 14 * 60]) {
      const podId = makeUuid();

      podRows.push({
        id: podId,
        content_type: 'episode',
        content_id: epId,
        at_sec: mid,
        pod_type: 'midroll',
        max_duration_sec: 120,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 1,
        duration_sec: 30,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 2,
        duration_sec: 15,
      });
    }

    const postId = makeUuid();

    podRows.push({
      id: postId,
      content_type: 'episode',
      content_id: epId,
      at_sec: null,
      pod_type: 'postroll',
      max_duration_sec: 60,
    });

    slotRows.push({
      id: makeUuid(),
      ad_pod_id: postId,
      position: 1,
      duration_sec: 15,
    });
  }

  function seedPodsForMovie(movieId: string) {
    const prerollId = makeUuid();

    podRows.push({
      id: prerollId,
      content_type: 'movie',
      content_id: movieId,
      at_sec: 0,
      pod_type: 'preroll',
      max_duration_sec: 120,
    });

    slotRows.push({
      id: makeUuid(),
      ad_pod_id: prerollId,
      position: 1,
      duration_sec: 30,
    });

    for (const mid of [20 * 60, 40 * 60, 70 * 60]) {
      const podId = makeUuid();

      podRows.push({
        id: podId,
        content_type: 'movie',
        content_id: movieId,
        at_sec: mid,
        pod_type: 'midroll',
        max_duration_sec: 150,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 1,
        duration_sec: 30,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 2,
        duration_sec: 30,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 3,
        duration_sec: 15,
      });
    }
  }
  function seedPodsForLive(eventId: string) {
    for (let i = 0; i < 6; i++) {
      const podId = makeUuid();

      podRows.push({
        id: podId,
        content_type: 'event_occurrence',
        content_id: eventId,
        at_sec: null,
        pod_type: 'linear_break',
        max_duration_sec: 120,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 1,
        duration_sec: 30,
      });

      slotRows.push({
        id: makeUuid(),
        ad_pod_id: podId,
        position: 2,
        duration_sec: 30,
      });
    }
  }

  if (episodeRows.length)
    for (const e of episodeRows.slice(0, Math.min(12, episodeRows.length)))
      seedPodsForEpisode(e.id);

  if (movieRows.length)
    for (const m of movieRows.slice(0, Math.min(5, movieRows.length)))
      seedPodsForMovie(m.id);

  if (eventOccurrencesRows.length)
    for (const ev of eventOccurrencesRows) seedPodsForLive(ev.id);

  if (podRows.length) await db.insertInto('ad_pods').values(podRows).execute();

  if (slotRows.length)
    await db.insertInto('pod_slots').values(slotRows).execute();

  // Campaigns & Creatives (creatives stamped with account)
  const campaigns: Insertable<CampaignsTable>[] = [];
  const creatives: Insertable<CreativesTable>[] = [];

  const formatCombos: Array<readonly ('preroll' | 'midroll' | 'display')[]> = [
    ['preroll', 'midroll'],
    ['display'],
    ['preroll', 'display'],
    ['midroll', 'display'],
    ['preroll', 'midroll', 'display'],
  ];

  const totalCampaigns = 8 * scale;

  for (let index = 0; index < totalCampaigns; index++) {
    const id = makeUuid();
    const formats = pickOne(rand, formatCombos);
    const priority = 1 + Math.floor(rand() * 10);
    const cpmBid = Number((1.5 + rand() * 12).toFixed(2));
    const dailyBudget = Number((50 + rand() * 450).toFixed(2));
    const pacingStrategy = rand() < 0.6 ? 'even' : 'asap';
    const freqCap = 1 + Math.floor(rand() * 4);

    const targeting_json = {
      geo: pickMany(rand, GEO_POOL, 3 + Math.floor(rand() * 3)),
      device: pickMany(rand, DEVICE_POOL, 1 + Math.floor(rand() * 1)),
      contentTags: pickMany(rand, TAG_POOL, 3 + Math.floor(rand() * 3)),
    };

    campaigns.push({
      id,
      name: `Campaign ${index + 1}`,
      priority,
      cpm_bid: cpmBid,
      daily_budget: dailyBudget,
      pacing_strategy: pacingStrategy as any,
      freq_cap_user_day: freqCap,
      targeting_json,
      formats_json: formats as any,
      active: true,
    });

    // Creatives: if video formats present, add a couple of video creatives
    const hasVideo = formats.includes('preroll') || formats.includes('midroll');

    if (hasVideo) {
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        line_item_id: null,
        type: 'video',
        duration_sec: 15,
        size: null,
        brand_safety: 'G',
        account_id: accountId,
      });

      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        line_item_id: null,
        type: 'video',
        duration_sec: 30,
        size: null,
        brand_safety: 'PG',
        account_id: accountId,
      });
    }

    // If display format present, add display banners
    if (formats.includes('display')) {
      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        line_item_id: null,
        type: 'display',
        duration_sec: null,
        size: '300x250',
        brand_safety: 'G',
        account_id: accountId,
      });

      creatives.push({
        id: makeUuid(),
        campaign_id: id,
        line_item_id: null,
        type: 'display',
        duration_sec: null,
        size: '728x90',
        brand_safety: 'G',
        account_id: accountId,
      });
    }
  }
  for (const c of campaigns) await repositories.campaigns.create(c);

  if (creatives.length)
    await db.insertInto('creatives').values(creatives).execute();

  // Attach campaign dimensions (guarded)
  const campaignDimRows: Array<{
    campaign_id: string;
    brand_id?: string | null;
    product_id?: string | null;
    studio_id?: string | null;
    movie_id?: string | null;
  }> = [];
  for (const c of campaigns) {
    const canUseBrand = brandRows.length && productRows.length;
    const canUseStudio = studioRows.length && movieRows.length;

    if (canUseBrand && (!canUseStudio || rand() < 0.5)) {
      const brand = brandRows[Math.floor(rand() * brandRows.length)];
      const prods = productRows.filter((p) => p.brand_id === brand.id);

      if (prods.length) {
        const prod = prods[Math.floor(rand() * prods.length)];
        campaignDimRows.push({
          campaign_id: c.id,
          brand_id: brand.id,
          product_id: prod.id,
          studio_id: null,
          movie_id: null,
        });
        continue;
      }
    }

    if (canUseStudio) {
      const st = studioRows[Math.floor(rand() * studioRows.length)];
      const movs = movieRows.filter((m) => m.studio_id === st.id);

      if (movs.length) {
        const mv = movs[Math.floor(rand() * movs.length)];
        campaignDimRows.push({
          campaign_id: c.id,
          brand_id: null,
          product_id: null,
          studio_id: st.id,
          movie_id: mv.id,
        });
        continue;
      }
    }
  }

  if (campaignDimRows.length)
    await db.insertInto('campaign_dim').values(campaignDimRows).execute();

  // Scenarios (scoped) 
  const scenarios: Insertable<ScenariosTable>[] = [
    {
      id: makeUuid(),
      name: 'Tech Article — Display Heavy',
      config_json: {
        content: {
          kind: 'article',
          brandSafety: 'G',
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
      created_at: null as any,
    },
    {
      id: makeUuid(),
      name: 'News Video — Pre/Midroll',
      config_json: {
        content: {
          kind: 'video',
          brandSafety: 'PG',
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
      created_at: null as any,
    },
  ];

  for (const s of scenarios) {
    await repositories.scenariosScoped.create({
      id: s.id,
      name: s.name,
      config_json: s.config_json,
      account_id: accountId,
      created_by_user_id: demoUserId,
      created_at: undefined as any,
    } as any);
  }

  // Demand (IO / LI / policy) with account ownership 
  const ioId1 = makeUuid();
  await db
    .insertInto('insertion_orders')
    .values({
      id: ioId1,
      name: 'Q4 Brand IO',
      advertiser: 'Acme Corp',
      start_date: new Date(),
      end_date: new Date(Date.now() + 60 * 86400000),
      budget_total: 250000,
      status: 'active',
      created_at: new Date() as any,
      account_id: accountId,
    })
    .execute();

  const ioId2 = makeUuid();
  await db
    .insertInto('insertion_orders')
    .values({
      id: ioId2,
      name: 'Studio Launch IO',
      advertiser: 'Nimbus Studios',
      start_date: new Date(),
      end_date: new Date(Date.now() + 45 * 86400000),
      budget_total: 180000,
      status: 'active',
      created_at: new Date() as any,
      account_id: accountId,
    })
    .execute();

  const li1 = {
    id: makeUuid(),
    io_id: ioId1,
    name: 'Acme Pre/Midroll',
    start_dt: new Date(),
    end_dt: new Date(Date.now() + 30 * 86400000),
    budget: 80000,
    cpm_bid: 22,
    pacing_strategy: 'even',
    targeting_json: {
      geo: ['US', 'CA'],
      device: ['desktop', 'mobile'],
      slot: ['preroll', 'midroll'],
    },
    caps_json: { freq_cap_user_day: 3 },
    floors_json: { first_in_pod: 25 },
    status: 'active',
    created_at: new Date() as any,
    account_id: accountId,
  };

  const li2 = {
    id: makeUuid(),
    io_id: ioId1,
    name: 'Acme Display Companions',
    start_dt: new Date(),
    end_dt: new Date(Date.now() + 30 * 86400000),
    budget: 20000,
    cpm_bid: 5,
    pacing_strategy: 'asap',
    targeting_json: { geo: ['US'], slot: ['display'] },
    caps_json: {},
    floors_json: {},
    status: 'active',
    created_at: new Date() as any,
    account_id: accountId,
  };

  const li3 = {
    id: makeUuid(),
    io_id: ioId2,
    name: 'Nimbus Launch Spots',
    start_dt: new Date(),
    end_dt: new Date(Date.now() + 40 * 86400000),
    budget: 100000,
    cpm_bid: 20,
    pacing_strategy: 'even',
    targeting_json: {
      genres: ['Sci-Fi', 'Comedy'],
      ratings: ['TV-PG', 'TV-14'],
    },
    caps_json: { freq_cap_user_day: 2 },
    floors_json: { preroll: 18 },
    status: 'active',
    created_at: new Date() as any,
    account_id: accountId,
  };

  await db.insertInto('line_items').values([li1, li2, li3]).execute();

  await db
    .insertInto('category_exclusions')
    .values([
      { id: makeUuid(), line_item_id: li1.id, category: 'alcohol' },
      { id: makeUuid(), line_item_id: li1.id, category: 'gambling' },
    ])
    .execute();

  await db
    .insertInto('competitive_separation')
    .values([
      {
        id: makeUuid(),
        line_item_id: li1.id,
        category: 'soft-drink',
        min_separation_min: 3,
      },
    ])
    .execute();

  await db
    .insertInto('creatives')
    .values([
      {
        id: makeUuid(),
        campaign_id: null,
        line_item_id: li1.id,
        type: 'video',
        duration_sec: 15,
        size: null,
        brand_safety: 'G',
        account_id: accountId,
      },
      {
        id: makeUuid(),
        campaign_id: null,
        line_item_id: li1.id,
        type: 'video',
        duration_sec: 30,
        size: null,
        brand_safety: 'PG',
        account_id: accountId,
      },
      {
        id: makeUuid(),
        campaign_id: null,
        line_item_id: li2.id,
        type: 'display',
        duration_sec: null,
        size: '300x250',
        brand_safety: 'G',
        account_id: accountId,
      },
      {
        id: makeUuid(),
        campaign_id: null,
        line_item_id: li3.id,
        type: 'video',
        duration_sec: 30,
        size: null,
        brand_safety: 'G',
        account_id: accountId,
      },
    ])
    .execute();
}

// Standalone runner (optional)
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
      await seedWithApp(app);
      console.log('Seed completed');
    } finally {
      await app.close();
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
