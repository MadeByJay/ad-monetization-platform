export type SlotType = 'preroll' | 'midroll' | 'display';

export interface SlotOpportunity {
  slotType: SlotType;
  user: { geo?: string; device?: 'desktop' | 'mobile'; userId?: string };
  content: { tags?: string[]; brandSafety?: 'G' | 'PG' | 'M' };
  ts: Date;
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
