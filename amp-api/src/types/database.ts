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
  campaign_id: string | null;
  line_item_id: string | null;
  type: 'video' | 'display';
  duration_sec: number | null;
  size: string | null;
  brand_safety: string | null;
  account_id?: string | null;
}

export interface ScenariosTable {
  id: string;
  name: string;
  config_json: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
  account_id?: string | null;
  created_by_user_id?: string | null;
}

export interface RunsTable {
  id: string;
  scenario_id: string | null;
  started_at: ColumnType<Date, string | undefined, never>;
  finished_at: Date | null;
  stats_json: unknown;
  account_id?: string | null;
  created_by_user_id?: string | null;
}
export interface RunRollupsTable {
  id: string;
  run_id: string;
  generated_at: Date;
  spend_over_time_json: unknown;
  top_facets_json: unknown;
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
  account_id?: string | null;
}

// Dimensions 
export interface BrandsTable {
  id: string;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ProductsTable {
  id: string;
  name: string;
  brand_id: string;
}

export interface StudiosTable {
  id: string;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface MoviesTable {
  id: string;
  title: string;
  studio_id: string;
  release_date: Date | null;
}

export interface CampaignDimTable {
  campaign_id: string;
  brand_id: string | null;
  product_id: string | null;
  studio_id: string | null;
  movie_id: string | null;
}

// Inventory - linear & streaming
export interface NetworksTable {
  id: string;
  name: string;
}

export interface ChannelsTable {
  id: string;
  network_id: string;
  name: string;
}

export interface ServicesTable {
  id: string;
  name: string;
  type: 'AVOD' | 'FAST' | 'SVOD' | 'HYBRID';
}

export interface SeriesTable {
  id: string;
  studio_id: string | null;
  title: string;
  genre: string | null;
  rating: string | null; 
}

export interface SeasonsTable {
  id: string;
  series_id: string;
  number: number;
}

export interface EpisodesTable {
  id: string;
  season_id: string;
  number: number;
  duration_sec: number | null;
}

export interface EventSeriesTable {
  id: string;
  studio_id: string | null;
  name: string;
  sport_or_kind: string | null;
}
export interface EventOccurrencesTable {
  id: string;
  event_series_id: string;
  starts_at: Date;
  venue: string | null;
  duration_sec: number | null;
}

export interface AdPodsTable {
  id: string;
  content_type: 'episode' | 'movie' | 'event_occurrence';
  content_id: string;
  at_sec: number | null; // null for linear “breaks by schedule”
  pod_type: 'preroll' | 'midroll' | 'postroll' | 'linear_break';
  max_duration_sec: number | null;
}

export interface PodSlotsTable {
  id: string;
  ad_pod_id: string;
  position: number;
  duration_sec: number;
}

// Demand 
export interface InsertionOrdersTable {
  id: string;
  name: string;
  advertiser: string;
  start_date: Date;
  end_date: Date;
  budget_total: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: ColumnType<Date, string | undefined, never>;
  account_id?: string | null;
}

export interface LineItemsTable {
  id: string;
  io_id: string;
  name: string;
  start_dt: Date;
  end_dt: Date;
  budget: number;
  cpm_bid: number;
  pacing_strategy: 'even' | 'asap';
  targeting_json: unknown;
  caps_json: unknown;
  floors_json: unknown;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: ColumnType<Date, string | undefined, never>;
  account_id?: string | null;
}

export interface CategoryExclusionsTable {
  id: string;
  line_item_id: string;
  category: string;
}

export interface CompetitiveSeparationTable {
  id: string;
  line_item_id: string;
  category: string;
  min_separation_min: number;
}

// Org tables
export interface AccountsTable {
  id: string;
  name: string;
  slug: string | null;
  created_at: Date;
}
export interface UsersTable {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  image_url: string | null;
  created_at: Date;
}
export type OrgRole =
  | 'owner'
  | 'admin'
  | 'sales'
  | 'trafficker'
  | 'analyst'
  | 'viewer';
export interface MembershipsTable {
  user_id: string;
  account_id: string;
  role: OrgRole;
  created_at: Date;
}

export interface Database {
  campaigns: CampaignsTable;
  creatives: CreativesTable;
  scenarios: ScenariosTable;
  runs: RunsTable;
  run_rollups: RunRollupsTable;
  impressions: ImpressionsTable;

  brands: BrandsTable;
  products: ProductsTable;
  studios: StudiosTable;
  movies: MoviesTable;
  campaign_dim: CampaignDimTable;

  networks: NetworksTable;
  channels: ChannelsTable;
  services: ServicesTable;
  series: SeriesTable;
  seasons: SeasonsTable;
  episodes: EpisodesTable;
  event_series: EventSeriesTable;
  event_occurrences: EventOccurrencesTable;
  ad_pods: AdPodsTable;
  pod_slots: PodSlotsTable;

  insertion_orders: InsertionOrdersTable;
  line_items: LineItemsTable;
  category_exclusions: CategoryExclusionsTable;
  competitive_separation: CompetitiveSeparationTable;

  accounts: AccountsTable;
  users: UsersTable;
  memberships: MembershipsTable;
}
