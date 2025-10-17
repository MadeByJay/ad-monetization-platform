export type SlotType = 'preroll' | 'midroll' | 'display';

/**
 * Industry content ratings (TV + MPAA).
 * Keep them as a single union so targeting and policy can use one field.
 */
export type IndustryRating =
  | 'TV-Y'
  | 'TV-Y7'
  | 'TV-G'
  | 'TV-PG'
  | 'TV-14'
  | 'TV-MA'
  | 'G'
  | 'PG'
  | 'PG-13'
  | 'R'
  | 'NC-17';

/**
 * Context about the content where the ad will run.
 * - tags: free-form content tags (also used for category exclusion)
 * - brandSafety: coarse creative/content safety (G/PG/M) kept for back-compat with earlier logic
 * - service_id: streaming app/service or FAST channel service id
 * - genre: content genre used by targeting/policy (e.g., 'Sci-Fi', 'Comedy')
 * - rating: industry rating (TV-* or MPAA) used by targeting/policy
 */
export interface ContentContext {
  tags?: string[];
  brandSafety?: 'G' | 'PG' | 'M';
  network_id?: string;
  channel_id?: string;
  service_id?: string;
  series_id?: string;
  season_id?: string;
  episode_id?: string;
  movie_id?: string;
  genre?: string;
  rating?: IndustryRating;
}

/**
 * Pod metadata when the opportunity is inside an ad pod.
 * position: 1 means first-in-pod (used for placement floors and constraints)
 * id: optional pod identifier if we want to trace back to the pod row
 */
export interface PodContext {
  position?: number;
  id?: string;
}

export interface SlotOpportunity {
  slotType: SlotType;
  user: { geo?: string; device?: 'desktop' | 'mobile'; userId?: string };
  content: ContentContext;
  ts: Date;
  pod?: PodContext;
}

export type DropReason =
  | 'inactive'
  | 'format_mismatch'
  | 'no_creatives'
  | 'budget'
  | 'pacing_overspend'
  | 'frequency'
  | 'floor'
  | 'brand_safety';

export interface EligibilityDrop {
  reason: DropReason;
  campaignId: string;
}

export interface ScoreBreakdown {
  campaignId: string;
  creativeId: string;
  cpmBid: number;
  priorityMultiplier: number;
  targetingScore: number;
  pacingMultiplier: number;
  finalScore: number;
}

export interface AuctionTrace {
  slotType: SlotType;
  eligibleCampaignIds: string[];
  dropped: EligibilityDrop[];
  scored: ScoreBreakdown[];
  winner?: { campaignId: string; creativeId: string; finalScore: number };
}
