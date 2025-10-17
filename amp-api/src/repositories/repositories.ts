import { type Kysely, type Insertable, sql } from 'kysely';
import type {
  Database,
  CampaignsTable,
  CreativesTable,
  ScenariosTable,
  RunsTable,
  ImpressionsTable,
} from '../types/database';

function toJsonb(value: unknown): string {
  return JSON.stringify(value ?? (Array.isArray(value) ? [] : {}));
}

export type DimensionFilters = {
  // Demand / brand-side:
  brand_id?: string;
  product_id?: string;
  studio_id?: string;
  movie_id?: string;
  // Inventory & content facets:
  network_id?: string;
  channel_id?: string;
  series_id?: string;
  season_id?: string;
  episode_id?: string;
  service_id?: string;
  genre?: string;
  rating?: string;
  slot?: 'preroll' | 'midroll' | 'display';
};

const DEFAULT_INSERT_BATCH_SIZE = Math.max(
  1,
  Number(process.env.INSERT_BATCH_SIZE ?? 1000),
);

export class Repositories {
  constructor(private readonly database: Kysely<Database>) {}

  private applyDimensionFilters(qb: any, filters?: DimensionFilters) {
    const f = filters ?? {};

    // 1 - slot type
    if (f.slot) qb = qb.where('impressions.slot_type', '=', f.slot);

    // 2 - brand/product/studio/movie via campaign_dim join
    const needsCampaignJoin = !!(
      f.brand_id ||
      f.product_id ||
      f.studio_id ||
      f.movie_id
    );

    if (needsCampaignJoin) {
      qb = qb.leftJoin(
        'campaign_dim',
        'campaign_dim.campaign_id',
        'impressions.campaign_id',
      );

      if (f.brand_id) qb = qb.where('campaign_dim.brand_id', '=', f.brand_id);
      if (f.product_id)
        qb = qb.where('campaign_dim.product_id', '=', f.product_id);
      if (f.studio_id)
        qb = qb.where('campaign_dim.studio_id', '=', f.studio_id);
      if (f.movie_id) qb = qb.where('campaign_dim.movie_id', '=', f.movie_id);
    }

    // 3 - inventory facets via JSONB (context_json->'content'->>'field')
    const jsonFilter = (field: string, value?: string) => {
      if (!value) return;
      qb = qb.where(({ eb, ref, sql }) =>
        eb(
          sql`(${ref('impressions.context_json')}->'content'->>${sql.lit(field)})`,
          '=',
          value,
        ),
      );
    };

    jsonFilter('network_id', f.network_id);
    jsonFilter('channel_id', f.channel_id);
    jsonFilter('series_id', f.series_id);
    jsonFilter('season_id', f.season_id);
    jsonFilter('episode_id', f.episode_id);
    jsonFilter('service_id', f.service_id);
    jsonFilter('genre', f.genre);
    jsonFilter('rating', f.rating);

    return qb;
  }

  // Keep the builder typing broad to avoid alias/overload friction with Kysely
  brands = {
    list: async () =>
      this.database
        .selectFrom('brands')
        .selectAll()
        .orderBy('name asc')
        .execute(),
  };

  products = {
    list: async (brandId?: string) => {
      let qb = this.database
        .selectFrom('products')
        .selectAll()
        .orderBy('name asc');
      if (brandId) qb = qb.where('brand_id', '=', brandId);
      return qb.execute();
    },
  };

  studios = {
    list: async () =>
      this.database
        .selectFrom('studios')
        .selectAll()
        .orderBy('name asc')
        .execute(),
  };

  movies = {
    list: async (studioId?: string) => {
      let qb = this.database
        .selectFrom('movies')
        .selectAll()
        .orderBy('title asc');
      if (studioId) qb = qb.where('studio_id', '=', studioId);
      return qb.execute();
    },
  };

  campaigns = {
    list: async () =>
      this.database.selectFrom('campaigns').selectAll().execute(),
    create: async (record: Insertable<CampaignsTable>) => {
      const jsonReady: Insertable<CampaignsTable> = {
        ...record,
        targeting_json: toJsonb(record.targeting_json),
        formats_json: toJsonb(record.formats_json),
      } as any;

      await this.database.insertInto('campaigns').values(jsonReady).execute();
    },
  };

  creatives = {
    list: async () =>
      this.database.selectFrom('creatives').selectAll().execute(),
    create: async (record: Insertable<CreativesTable>) => {
      await this.database.insertInto('creatives').values(record).execute();
    },
    listByCampaign: async (campaignId: string) =>
      this.database
        .selectFrom('creatives')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .execute(),
  };

  scenarios = {
    list: async () =>
      this.database
        .selectFrom('scenarios')
        .selectAll()
        .orderBy('created_at desc')
        .execute(),
    get: async (id: string) =>
      this.database
        .selectFrom('scenarios')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    create: async (record: Insertable<ScenariosTable>) => {
      const jsonReady: Insertable<ScenariosTable> = {
        ...record,
        config_json: toJsonb(record.config_json),
      } as any;

      await this.database.insertInto('scenarios').values(jsonReady).execute();
    },
    update: async (
      id: string,
      payload: { name: string; config_json: unknown },
    ) => {
      await this.database
        .updateTable('scenarios')
        .set({
          name: payload.name,
          config_json: toJsonb(payload.config_json) as any,
        })
        .where('id', '=', id)
        .execute();
    },
    remove: async (id: string) => {
      await this.database
        .deleteFrom('scenarios')
        .where('id', '=', id)
        .execute();
    },
  };

  runs = {
    create: async (record: Insertable<RunsTable>) => {
      const jsonReady: Insertable<RunsTable> = {
        ...record,
        stats_json: toJsonb(record.stats_json),
      } as any;

      await this.database.insertInto('runs').values(jsonReady).execute();
    },
    finish: async (id: string, stats: unknown) => {
      await this.database
        .updateTable('runs')
        .set({ finished_at: new Date(), stats_json: toJsonb(stats) as any })
        .where('id', '=', id)
        .execute();
    },
    get: async (id: string) =>
      this.database
        .selectFrom('runs')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    listLatest: async (limit = 50) =>
      this.database
        .selectFrom('runs')
        .selectAll()
        .orderBy('started_at desc')
        .limit(limit)
        .execute(),
  };

  impressions = {
    bulkInsert: async (rows: Insertable<ImpressionsTable>[]) => {
      const mapped = rows.map((row) => ({
        ...row,
        context_json: toJsonb(row.context_json),
        trace_json: toJsonb(row.trace_json),
      })) as any[];

      const batchSize = DEFAULT_INSERT_BATCH_SIZE;
      for (let index = 0; index < mapped.length; index += batchSize) {
        const slice = mapped.slice(index, index + batchSize);
        const start = Date.now();

        await this.database.insertInto('impressions').values(slice).execute();

        const elapsed = (Date.now() - start) / 1000;

        // metrics via process global (bound in app bootstrap)
        try {
          const metrics = (global as any).AMP_METRICS;

          metrics?.dbInsertBatchDurationSeconds
            ?.labels('impressions')
            ?.observe(elapsed);

          metrics?.dbInsertBatchesTotal?.labels('impressions')?.inc();
        } catch {}
      }
    },
    listByRun: async (runId: string) =>
      this.database
        .selectFrom('impressions')
        .selectAll()
        .where('run_id', '=', runId)
        .execute(),
    listByRunFiltered: async (runId: string, filters?: DimensionFilters) => {
      const qb = this.database
        .selectFrom('impressions')
        .selectAll()
        .where('run_id', '=', runId);
      const q = this.applyDimensionFilters(qb, filters);
      return q.execute();
    },
    //Count filtered impressions for a run (for pagination)
    countByRunFiltered: async (
      runId: string,
      filters?: DimensionFilters,
    ): Promise<number> => {
      const qb = this.database
        .selectFrom('impressions')
        .select(({ fn }) => [fn.countAll().as('c')])
        .where('run_id', '=', runId);
      const q = this.applyDimensionFilters(qb, filters);
      const row = await q.executeTakeFirst();
      return Number((row as any)?.c ?? 0);
    },
    // Paged filtered list
    listByRunPagedFiltered: async (
      runId: string,
      filters: DimensionFilters | undefined,
      offset: number,
      limit: number,
    ) => {
      const qb = this.database
        .selectFrom('impressions')
        .selectAll()
        .where('run_id', '=', runId)
        .offset(offset)
        .limit(limit)
        .orderBy('ts asc');
      const q = this.applyDimensionFilters(qb, filters);
      return q.execute();
    },
  };

  // Impressions quick counts (for rollup path)
  impressionsQuick = {
    countTotals: async (runId: string) => {
      const row = await this.database
        .selectFrom('impressions')
        .select(({ fn }) => [
          fn.countAll().as('total'),
          fn.count('campaign_id').as('delivered'), // counts only non-null campaign_id
        ])
        .where('run_id', '=', runId)
        .executeTakeFirst();

      return {
        total: Number((row as any)?.total ?? 0),
        delivered: Number((row as any)?.delivered ?? 0),
      };
    },
    averageCpmDelivered: async (runId: string) => {
      const row = await this.database
        .selectFrom('impressions')
        .select(({ fn }) => [fn.avg('cpm').as('avg')])
        .where('run_id', '=', runId)
        .where('campaign_id', 'is not', null)
        .executeTakeFirst();

      return Number((row as any)?.avg ?? 0);
    },
  };

  rollups = {
    upsertRunRollup: async (
      runId: string,
      spendOverTime: any,
      topFacets: any,
    ) => {
      const exists = await this.database
        .selectFrom('run_rollups')
        .select('id')
        .where('run_id', '=', runId)
        .executeTakeFirst();

      const payload = {
        id: exists?.id ?? crypto.randomUUID(),
        run_id: runId,
        generated_at: new Date() as any,
        spend_over_time_json: toJsonb(spendOverTime) as any,
        top_facets_json: toJsonb(topFacets) as any,
      };

      if (exists) {
        await this.database
          .updateTable('run_rollups')
          .set({
            generated_at: payload.generated_at,
            spend_over_time_json: payload.spend_over_time_json,
            top_facets_json: payload.top_facets_json,
          })
          .where('run_id', '=', runId)
          .execute();
      } else {
        await this.database
          .insertInto('run_rollups')
          .values(payload as any)
          .execute();
      }
    },

    getRunRollup: async (runId: string) =>
      this.database
        .selectFrom('run_rollups')
        .selectAll()
        .where('run_id', '=', runId)
        .executeTakeFirst(),

    // Efficient spend over time from DB (minute buckets)
    spendOverTimeFromDb: async (runId: string) => {
      // Build one SQL expression and reuse it in SELECT/GROUP BY/ORDER BY
      const bucketExpr = sql`date_trunc('minute', ts)`;

      const rows = await this.database
        .selectFrom('impressions')
        .select(({ fn }) => [
          bucketExpr.as('bucket'),
          fn.sum('revenue').as('revenue'),
        ])
        .where('run_id', '=', runId)
        .groupBy(bucketExpr)
        .orderBy(bucketExpr)
        .execute();

      const result: Record<string, number> = {};
      for (const row of rows as Array<{
        bucket: string | Date;
        revenue: string | number | null;
      }>) {
        const key =
          typeof row.bucket === 'string'
            ? row.bucket
            : new Date(row.bucket as Date).toISOString();
        result[key] = Number(row.revenue ?? 0);
      }
      return result;
    },
  };

  // Inventory readers 
  networks = {
    list: async () =>
      this.database
        .selectFrom('networks')
        .selectAll()
        .orderBy('name asc')
        .execute(),
  };

  channels = {
    listByNetwork: async (networkId: string) =>
      this.database
        .selectFrom('channels')
        .selectAll()
        .where('network_id', '=', networkId)
        .orderBy('name asc')
        .execute(),
  };

  services = {
    list: async () =>
      this.database
        .selectFrom('services')
        .selectAll()
        .orderBy('name asc')
        .execute(),
  };

  series = {
    list: async () =>
      this.database
        .selectFrom('series')
        .selectAll()
        .orderBy('title asc')
        .execute(),
  };

  seasons = {
    listBySeries: async (seriesId: string) =>
      this.database
        .selectFrom('seasons')
        .selectAll()
        .where('series_id', '=', seriesId)
        .orderBy('number asc')
        .execute(),
  };

  episodes = {
    listBySeason: async (seasonId: string) =>
      this.database
        .selectFrom('episodes')
        .selectAll()
        .where('season_id', '=', seasonId)
        .orderBy('number asc')
        .execute(),
  };

  eventSeries = {
    list: async () =>
      this.database
        .selectFrom('event_series')
        .selectAll()
        .orderBy('name asc')
        .execute(),
  };

  eventOccurrences = {
    listByEventSeries: async (eventSeriesId: string) =>
      this.database
        .selectFrom('event_occurrences')
        .selectAll()
        .where('event_series_id', '=', eventSeriesId)
        .orderBy('starts_at asc')
        .execute(),
  };

  // Pods & slots
  pods = {
    listByContent: async (
      contentType: 'episode' | 'movie' | 'event_occurrence',
      contentId: string,
    ) =>
      this.database
        .selectFrom('ad_pods')
        .selectAll()
        .where('content_type', '=', contentType)
        .where('content_id', '=', contentId)
        .orderBy('at_sec asc')
        .execute(),

    bulkInsert: async (
      pods: Array<Insertable<import('../types/database').AdPodsTable>>,
    ) => {
      await this.database.insertInto('ad_pods').values(pods).execute();
    },
  };

  podSlots = {
    listByPod: async (podId: string) =>
      this.database
        .selectFrom('pod_slots')
        .selectAll()
        .where('ad_pod_id', '=', podId)
        .orderBy('position asc')
        .execute(),

    bulkInsert: async (
      slots: Array<Insertable<import('../types/database').PodSlotsTable>>,
    ) => {
      await this.database.insertInto('pod_slots').values(slots).execute();
    },
  };

  // Convenience: build a tree for the UI picker
  inventory = {
    tree: async () => {
      const [networks, services, series, eventSeries] = await Promise.all([
        this.networks.list(),
        this.services.list(),
        this.series.list(),
        this.eventSeries.list(),
      ]);

      const channelsByNetwork = new Map<string, any[]>();
      for (const n of networks)
        channelsByNetwork.set(n.id, await this.channels.listByNetwork(n.id));

      const seasonsBySeries = new Map<string, any[]>();
      const episodesBySeason = new Map<string, any[]>();

      for (const s of series) {
        const seasons = await this.seasons.listBySeries(s.id);
        seasonsBySeries.set(s.id, seasons);
        for (const season of seasons) {
          episodesBySeason.set(
            season.id,
            await this.episodes.listBySeason(season.id),
          );
        }
      }

      const eventsBySeries = new Map<string, any[]>();
      for (const es of eventSeries) {
        eventsBySeries.set(
          es.id,
          await this.eventOccurrences.listByEventSeries(es.id),
        );
      }

      return {
        networks: networks.map((n) => ({
          ...n,
          channels: channelsByNetwork.get(n.id) ?? [],
        })),
        services,
        series: series.map((s) => ({
          ...s,
          seasons: (seasonsBySeries.get(s.id) ?? []).map((se) => ({
            ...se,
            episodes: episodesBySeason.get(se.id) ?? [],
          })),
        })),
        event_series: eventSeries.map((es) => ({
          ...es,
          occurrences: eventsBySeries.get(es.id) ?? [],
        })),
      };
    },
  };
  // Insertion Orders 
  insertionOrders = {
    list: async () =>
      this.database
        .selectFrom('insertion_orders')
        .selectAll()
        .orderBy('created_at desc')
        .execute(),
    get: async (id: string) =>
      this.database
        .selectFrom('insertion_orders')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    create: async (
      r: Insertable<import('../types/database').InsertionOrdersTable>,
    ) => {
      await this.database.insertInto('insertion_orders').values(r).execute();
    },
    update: async (
      id: string,
      p: Partial<import('../types/database').InsertionOrdersTable>,
    ) => {
      await this.database
        .updateTable('insertion_orders')
        .set(p as any)
        .where('id', '=', id)
        .execute();
    },
    remove: async (id: string) => {
      await this.database
        .deleteFrom('insertion_orders')
        .where('id', '=', id)
        .execute();
    },
  };

  // Line Items 
  lineItems = {
    listByIo: async (ioId: string) =>
      this.database
        .selectFrom('line_items')
        .selectAll()
        .where('io_id', '=', ioId)
        .orderBy('created_at desc')
        .execute(),
    get: async (id: string) =>
      this.database
        .selectFrom('line_items')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    create: async (
      r: Insertable<import('../types/database').LineItemsTable>,
    ) => {
      const v = {
        ...r,
        targeting_json: toJsonb(r.targeting_json),
        caps_json: toJsonb(r.caps_json),
        floors_json: toJsonb(r.floors_json),
      } as any;
      await this.database.insertInto('line_items').values(v).execute();
    },
    update: async (
      id: string,
      p: Partial<import('../types/database').LineItemsTable>,
    ) => {
      const v = { ...p } as any;
      if ('targeting_json' in v) v.targeting_json = toJsonb(v.targeting_json);
      if ('caps_json' in v) v.caps_json = toJsonb(v.caps_json);
      if ('floors_json' in v) v.floors_json = toJsonb(v.floors_json);
      await this.database
        .updateTable('line_items')
        .set(v)
        .where('id', '=', id)
        .execute();
    },
    remove: async (id: string) => {
      await this.database
        .deleteFrom('line_items')
        .where('id', '=', id)
        .execute();
    },
  };

  // Creatives (for line items) 
  liCreatives = {
    listByLineItem: async (liId: string) =>
      this.database
        .selectFrom('creatives')
        .selectAll()
        .where('line_item_id', '=', liId)
        .orderBy('id asc')
        .execute(),
    createForLineItem: async (
      r: Insertable<import('../types/database').CreativesTable>,
    ) => {
      await this.database.insertInto('creatives').values(r).execute();
    },
    update: async (
      id: string,
      p: Partial<import('../types/database').CreativesTable>,
    ) => {
      await this.database
        .updateTable('creatives')
        .set(p as any)
        .where('id', '=', id)
        .execute();
    },
    remove: async (id: string) => {
      await this.database
        .deleteFrom('creatives')
        .where('id', '=', id)
        .execute();
    },
  };

  // Line Items helpers for auction 
  lineItemsAuction = {
    // Active line items in date window
    listActiveAt: async (at: Date) =>
      this.database
        .selectFrom('line_items')
        .selectAll()
        .where('status', '=', 'active')
        .where('start_dt', '<=', at)
        .where('end_dt', '>=', at)
        .execute(),

    getPolicies: async (liId: string) => {
      const [excl, sep] = await Promise.all([
        this.database
          .selectFrom('category_exclusions')
          .selectAll()
          .where('line_item_id', '=', liId)
          .execute(),
        this.database
          .selectFrom('competitive_separation')
          .selectAll()
          .where('line_item_id', '=', liId)
          .execute(),
      ]);
      return { exclusions: excl.map((e) => e.category), separations: sep };
    },

    getCreatives: async (liId: string) =>
      this.database
        .selectFrom('creatives')
        .selectAll()
        .where('line_item_id', '=', liId)
        .execute(),
  };

  // Policy 
  categoryExclusions = {
    listByLineItem: async (liId: string) =>
      this.database
        .selectFrom('category_exclusions')
        .selectAll()
        .where('line_item_id', '=', liId)
        .execute(),
    replace: async (liId: string, cats: string[]) => {
      await this.database
        .deleteFrom('category_exclusions')
        .where('line_item_id', '=', liId)
        .execute();
      if (cats.length) {
        await this.database
          .insertInto('category_exclusions')
          .values(
            cats.map((c) => ({
              id: crypto.randomUUID(),
              line_item_id: liId,
              category: c,
            })),
          )
          .execute();
      }
    },
  };

  competitiveSeparation = {
    get: async (liId: string) =>
      this.database
        .selectFrom('competitive_separation')
        .selectAll()
        .where('line_item_id', '=', liId)
        .execute(),
    upsert: async (
      liId: string,
      rules: Array<{ category: string; min_separation_min: number }>,
    ) => {
      await this.database
        .deleteFrom('competitive_separation')
        .where('line_item_id', '=', liId)
        .execute();
      if (rules.length) {
        await this.database
          .insertInto('competitive_separation')
          .values(
            rules.map((r) => ({
              id: crypto.randomUUID(),
              line_item_id: liId,
              category: r.category,
              min_separation_min: r.min_separation_min,
            })),
          )
          .execute();
      }
    },
  };

  // Org repositories 
  accounts = {
    getBySlug: async (slug: string) =>
      this.database
        .selectFrom('accounts')
        .selectAll()
        .where('slug', '=', slug)
        .executeTakeFirst(),
    getById: async (id: string) =>
      this.database
        .selectFrom('accounts')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
  };

  users = {
    getByEmail: async (email: string) =>
      this.database
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst(),
    getById: async (id: string) =>
      this.database
        .selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
    create: async (
      record: Insertable<import('../types/database').UsersTable>,
    ) => {
      await this.database.insertInto('users').values(record).execute();
    },
  };

  memberships = {
    listByUser: async (userId: string) =>
      this.database
        .selectFrom('memberships')
        .selectAll()
        .where('user_id', '=', userId)
        .execute(),
    get: async (userId: string, accountId: string) =>
      this.database
        .selectFrom('memberships')
        .selectAll()
        .where('user_id', '=', userId)
        .where('account_id', '=', accountId)
        .executeTakeFirst(),
  };

  // Scoped variants (examples for scenarios/runs) 
  scenariosScoped = {
    list: async (accountId: string) =>
      this.database
        .selectFrom('scenarios')
        .selectAll()
        .where('account_id', '=', accountId)
        .orderBy('created_at desc')
        .execute(),
    get: async (accountId: string, id: string) =>
      this.database
        .selectFrom('scenarios')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('id', '=', id)
        .executeTakeFirst(),
    create: async (
      record: Insertable<ScenariosTable> & {
        account_id: string;
        created_by_user_id?: string | null;
      },
    ) => {
      const jsonReady = {
        ...record,
        config_json: toJsonb(record.config_json),
      } as any;
      await this.database.insertInto('scenarios').values(jsonReady).execute();
    },
    update: async (
      accountId: string,
      id: string,
      payload: { name: string; config_json: unknown },
    ) => {
      await this.database
        .updateTable('scenarios')
        .set({
          name: payload.name,
          config_json: toJsonb(payload.config_json) as any,
        })
        .where('account_id', '=', accountId)
        .where('id', '=', id)
        .execute();
    },
    remove: async (accountId: string, id: string) => {
      await this.database
        .deleteFrom('scenarios')
        .where('account_id', '=', accountId)
        .where('id', '=', id)
        .execute();
    },
  };

  runsScoped = {
    listLatest: async (accountId: string, limit = 50) =>
      this.database
        .selectFrom('runs')
        .selectAll()
        .where('account_id', '=', accountId)
        .orderBy('started_at desc')
        .limit(limit)
        .execute(),
    create: async (
      record: Insertable<RunsTable> & {
        account_id: string;
        created_by_user_id?: string | null;
      },
    ) => {
      await this.database
        .insertInto('runs')
        .values({ ...record, stats_json: toJsonb(record.stats_json) as any })
        .execute();
    },
  };

  // Scoped Insertion Orders 
  insertionOrdersScoped = {
    list: async (accountId: string) =>
      this.database
        .selectFrom('insertion_orders')
        .selectAll()
        .where('account_id', '=', accountId)
        .orderBy('created_at desc')
        .execute(),

    get: async (accountId: string, insertionOrderId: string) =>
      this.database
        .selectFrom('insertion_orders')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('id', '=', insertionOrderId)
        .executeTakeFirst(),

    create: async (
      record: import('../types/database').InsertionOrdersTable & {
        account_id: string;
      },
    ) => {
      await this.database
        .insertInto('insertion_orders')
        .values(record as any)
        .execute();
    },

    update: async (
      accountId: string,
      insertionOrderId: string,
      payload: Partial<import('../types/database').InsertionOrdersTable>,
    ) => {
      await this.database
        .updateTable('insertion_orders')
        .set(payload as any)
        .where('account_id', '=', accountId)
        .where('id', '=', insertionOrderId)
        .execute();
    },

    remove: async (accountId: string, insertionOrderId: string) => {
      await this.database
        .deleteFrom('insertion_orders')
        .where('account_id', '=', accountId)
        .where('id', '=', insertionOrderId)
        .execute();
    },
  };

  // Scoped Line Items 
  lineItemsScoped = {
    listByInsertionOrder: async (accountId: string, insertionOrderId: string) =>
      this.database
        .selectFrom('line_items')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('io_id', '=', insertionOrderId)
        .orderBy('created_at desc')
        .execute(),

    get: async (accountId: string, lineItemId: string) =>
      this.database
        .selectFrom('line_items')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('id', '=', lineItemId)
        .executeTakeFirst(),

    create: async (
      record: import('../types/database').LineItemsTable & {
        account_id: string;
      },
    ) => {
      const v = {
        ...record,
        targeting_json: toJsonb(record.targeting_json),
        caps_json: toJsonb(record.caps_json),
        floors_json: toJsonb(record.floors_json),
      } as any;
      await this.database.insertInto('line_items').values(v).execute();
    },

    update: async (
      accountId: string,
      lineItemId: string,
      payload: Partial<import('../types/database').LineItemsTable>,
    ) => {
      const v = { ...payload } as any;
      if ('targeting_json' in v) v.targeting_json = toJsonb(v.targeting_json);
      if ('caps_json' in v) v.caps_json = toJsonb(v.caps_json);
      if ('floors_json' in v) v.floors_json = toJsonb(v.floors_json);
      await this.database
        .updateTable('line_items')
        .set(v)
        .where('account_id', '=', accountId)
        .where('id', '=', lineItemId)
        .execute();
    },

    remove: async (accountId: string, lineItemId: string) => {
      await this.database
        .deleteFrom('line_items')
        .where('account_id', '=', accountId)
        .where('id', '=', lineItemId)
        .execute();
    },
  };

  // Scoped Creatives for Line Items 
  liCreativesScoped = {
    listByLineItem: async (accountId: string, lineItemId: string) =>
      this.database
        .selectFrom('creatives')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('line_item_id', '=', lineItemId)
        .orderBy('id asc')
        .execute(),

    createForLineItem: async (
      record: import('../types/database').CreativesTable & {
        account_id: string;
      },
    ) => {
      await this.database
        .insertInto('creatives')
        .values(record as any)
        .execute();
    },

    update: async (
      accountId: string,
      creativeId: string,
      payload: Partial<import('../types/database').CreativesTable>,
    ) => {
      await this.database
        .updateTable('creatives')
        .set(payload as any)
        .where('account_id', '=', accountId)
        .where('id', '=', creativeId)
        .execute();
    },

    remove: async (accountId: string, creativeId: string) => {
      await this.database
        .deleteFrom('creatives')
        .where('account_id', '=', accountId)
        .where('id', '=', creativeId)
        .execute();
    },
  };

  // Scoped Policy helpers 
  policyScoped = {
    listExclusions: async (accountId: string, lineItemId: string) =>
      this.database
        .selectFrom('category_exclusions')
        .selectAll()
        .where('line_item_id', '=', lineItemId)
        .where(({ eb, ref }) =>
          eb(
            'line_item_id',
            'in',
            this.database
              .selectFrom('line_items')
              .select('id')
              .where('id', '=', lineItemId)
              .where('account_id', '=', accountId),
          ),
        )
        .execute(),

    replaceExclusions: async (
      accountId: string,
      lineItemId: string,
      categories: string[],
    ) => {
      // Ensure LI belongs to account
      const own = await this.lineItemsScoped.get(accountId, lineItemId);
      if (!own) return;
      await this.database
        .deleteFrom('category_exclusions')
        .where('line_item_id', '=', lineItemId)
        .execute();
      if (categories.length) {
        await this.database
          .insertInto('category_exclusions')
          .values(
            categories.map((c) => ({
              id: crypto.randomUUID(),
              line_item_id: lineItemId,
              category: c,
            })),
          )
          .execute();
      }
    },

    listCompetitiveSeparation: async (accountId: string, lineItemId: string) =>
      this.database
        .selectFrom('competitive_separation')
        .selectAll()
        .where('line_item_id', '=', lineItemId)
        .where(({ eb }) =>
          eb(
            'line_item_id',
            'in',
            this.database
              .selectFrom('line_items')
              .select('id')
              .where('id', '=', lineItemId)
              .where('account_id', '=', accountId),
          ),
        )
        .execute(),

    upsertCompetitiveSeparation: async (
      accountId: string,
      lineItemId: string,
      rules: Array<{ category: string; min_separation_min: number }>,
    ) => {
      const own = await this.lineItemsScoped.get(accountId, lineItemId);
      if (!own) return;
      await this.database
        .deleteFrom('competitive_separation')
        .where('line_item_id', '=', lineItemId)
        .execute();
      if (rules.length) {
        await this.database
          .insertInto('competitive_separation')
          .values(
            rules.map((r) => ({
              id: crypto.randomUUID(),
              line_item_id: lineItemId,
              category: r.category,
              min_separation_min: r.min_separation_min,
            })),
          )
          .execute();
      }
    },
  };
}
