import { ColumnType } from 'kysely';

export interface CampaignsTable {
  id: string;
  name: string;
  priority: number;
  cpm_bid: number;
  daily_budget: number;
  pacing_strategy: 'even' | 'asap';
  freq_cap_user_day: number;
  targeting_json: unknown;
  formats_json: unknown;
  active: boolean;
}

export interface CreativesTable {
  id: string;
  campaign_id: string;
  type: 'video' | 'display';
  duration_sec: number | null;
  size: string | null;
  brand_safety: string | null;
}

export interface ScenariosTable {
  id: string;
  name: string;
  config_json: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RunsTable {
  id: string;
  scenario_id: string | null;
  started_at: ColumnType<Date, string | undefined, never>;
  finished_at: Date | null;
  stats_json: unknown;
}

export interface ImpressionsTable {
  id: string;
  run_id: string;
  slot_type: 'preroll' | 'midroll' | 'display';
  ts: ColumnType<Date, string | undefined, never>;
  campaign_id: string | null;
  creative_id: string | null;
  cpm: number | null;
  revenue: number | null;
  user_id: string | null;
  context_json: unknown;
  trace_json: unknown;
}

export interface Database {
  campaigns: CampaignsTable;
  creatives: CreativesTable;
  scenarios: ScenariosTable;
  runs: RunsTable;
  impressions: ImpressionsTable;
}
