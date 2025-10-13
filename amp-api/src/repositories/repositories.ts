import type { Kysely, Insertable } from 'kysely';
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

export class Repositories {
  constructor(private readonly database: Kysely<Database>) {}

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
    create: async (record: Insertable<ScenariosTable>) => {
      const jsonReady: Insertable<ScenariosTable> = {
        ...record,
        config_json: toJsonb(record.config_json),
      } as any;

      await this.database.insertInto('scenarios').values(jsonReady).execute();
    },
    get: async (id: string) =>
      this.database
        .selectFrom('scenarios')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst(),
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

      await this.database.insertInto('impressions').values(mapped).execute();
    },
    listByRun: async (runId: string) =>
      this.database
        .selectFrom('impressions')
        .selectAll()
        .where('run_id', '=', runId)
        .execute(),
  };
}
