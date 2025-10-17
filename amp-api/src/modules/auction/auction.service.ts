import { Injectable } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import { TargetingService } from './targeting.service';
import { PacingService } from '../pacing/pacing.service';
import { MetricsService } from '../metrics/metrics.service';
import { FrequencyService } from '../frequency/frequency.service';
import type { AuctionTrace, SlotOpportunity } from './auction.types';

type Rating =
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

const ratingRank: Record<string, number> = {
  'TV-Y': 0,
  'TV-Y7': 1,
  'TV-G': 2,
  G: 2,
  'TV-PG': 3,
  PG: 3,
  'TV-14': 4,
  'PG-13': 4,
  'TV-MA': 5,
  R: 5,
  'NC-17': 6,
};

export interface AuctionContext {
  runId: string;
  // In-run policy memory (avoid DB roundtrips for competitive separation)
  recentWins?: Map<string, Array<{ ts: number; categories: string[] }>>; // key: category
}

function stableHash(input: string): number {
  // simple 32-bit FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash =
      (hash +
        ((hash << 1) +
          (hash << 4) +
          (hash << 7) +
          (hash << 8) +
          (hash << 24))) >>>
      0;
  }
  return hash >>> 0;
}

@Injectable()
export class AuctionService {
  private readonly globalFloor = Number(
    process.env.FLOOR_PRICE_CPM_GLOBAL ?? 0,
  );

  private readonly firstInPodFloor = Number(
    process.env.FLOOR_PRICE_CPM_FIRST_IN_POD ?? 0,
  );

  constructor(
    private readonly repositories: Repositories,
    private readonly targeting: TargetingService,
    private readonly pacing: PacingService,
    private readonly metrics: MetricsService,
    private readonly frequency: FrequencyService,
  ) {}
  async run(
    opportunity: SlotOpportunity,
    ctx: AuctionContext,
  ): Promise<AuctionTrace> {
    const now = opportunity.ts;
    const lineItems =
      await this.repositories.lineItemsAuction.listActiveAt(now);

    const trace: AuctionTrace = {
      slotType: opportunity.slotType,
      eligibleCampaignIds: [], // deprecated semantic; kept for UI compat
      dropped: [],
      scored: [],
    };

    const requiredFormat =
      opportunity.slotType === 'display' ? 'display' : 'video';
    const isFirstInPod = (opportunity as any).pod?.position === 1;
    const placementFloor = isFirstInPod ? this.firstInPodFloor : 0;

    for (const li of lineItems) {
      // TARGETING
      const targeting =
        typeof li.targeting_json === 'string'
          ? JSON.parse(li.targeting_json as any)
          : (li.targeting_json as any);

      if (!this.matchBasicTargeting(opportunity, targeting)) {
        trace.dropped.push({ reason: 'format_mismatch', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('format_mismatch').inc();
        continue;
      }

      // DAYPART
      if (!this.matchDaypart(now, targeting?.dayparts)) {
        trace.dropped.push({ reason: 'inactive', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('inactive').inc();
        continue;
      }

      // CONTENT rating/genre/service/app (best-effort)
      if (!this.matchContentFacets(opportunity, targeting)) {
        trace.dropped.push({ reason: 'brand_safety', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('brand_safety').inc();
        continue;
      }

      // CATEGORY EXCLUSION vs content tags
      const { exclusions, separations } =
        await this.repositories.lineItemsAuction.getPolicies(li.id);

      const contentTags: string[] = opportunity.content.tags ?? [];

      if (exclusions.some((cat) => contentTags.includes(cat))) {
        trace.dropped.push({ reason: 'brand_safety', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('brand_safety').inc();
        continue;
      }

      // COMPETITIVE SEPARATION vs recent wins (in-memory per run)
      if (separations.length && this.violatesSeparation(separations, ctx)) {
        trace.dropped.push({ reason: 'pacing_overspend', campaignId: li.id }); // reuse reason bucket; we also count policy below
        this.metrics.eligibilityDroppedTotal.labels('pacing_overspend').inc();
        continue;
      }

      // CREATIVE FILTER (format + safety)
      const creatives = await this.repositories.lineItemsAuction.getCreatives(
        li.id,
      );

      const usable = creatives.filter((c) => {
        const typeOk = c.type === requiredFormat;
        const ratingOk = this.creativeVsContentSafetyOk(
          opportunity.content.rating as any,
          c.brand_safety ?? 'G',
        );
        return typeOk && ratingOk;
      });

      if (usable.length === 0) {
        trace.dropped.push({ reason: 'no_creatives', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('no_creatives').inc();
        continue;
      }

      // FLOORS (global + placement + LI floors)
      const liFloors =
        typeof li.floors_json === 'string'
          ? JSON.parse(li.floors_json as any)
          : (li.floors_json as any);

      const liPlacementFloor = isFirstInPod
        ? Number(liFloors?.first_in_pod ?? 0)
        : Number(liFloors?.[opportunity.slotType] ?? 0);

      const effectiveFloor = Math.max(
        this.globalFloor,
        placementFloor,
        liPlacementFloor,
      );

      const bid = Number((li as any).cpm_bid ?? 15);
      if (bid < effectiveFloor) {
        trace.dropped.push({ reason: 'floor', campaignId: li.id });
        this.metrics.eligibilityDroppedTotal.labels('floor').inc();
        continue;
      }

      // SCORE (simple: bid × match multipliers; priority later if needed)
      const targetingScore = this.basicTargetingScore(opportunity, targeting);
      const finalScore = bid * targetingScore;

      for (const cr of usable) {
        trace.scored.push({
          campaignId: li.id, // we display LI id as campaign id for now
          creativeId: cr.id,
          cpmBid: bid,
          priorityMultiplier: 1,
          targetingScore,
          pacingMultiplier: 1,
          finalScore,
        });
      }
    }

    // Winner with deterministic tie-break
    if (trace.scored.length > 0) {
      const eps = 1e-9;
      trace.scored.sort((a, b) => {
        const d = b.finalScore - a.finalScore;

        if (Math.abs(d) > eps) return d > 0 ? 1 : -1;

        // tie -> deterministic hash on creative+time
        const ha = stableHash(
          `${a.creativeId}:${trace.slotType}:${opportunity.ts.getTime()}`,
        );
        const hb = stableHash(
          `${b.creativeId}:${trace.slotType}:${opportunity.ts.getTime()}`,
        );

        return hb - ha;
      });

      const top = trace.scored[0];

      trace.winner = {
        campaignId: top.campaignId,
        creativeId: top.creativeId,
        finalScore: top.finalScore,
      };

      // Update policy memory for competitive separation
      const li = lineItems.find((x) => x.id === top.campaignId);

      const liTargeting =
        typeof li?.targeting_json === 'string'
          ? JSON.parse(li!.targeting_json as any)
          : (li?.targeting_json as any);

      const categories: string[] = (liTargeting?.categories ?? []) as string[];

      if (categories?.length) {
        const store = ctx.recentWins ?? new Map();
        ctx.recentWins = store;
        const nowSec = Math.floor(opportunity.ts.getTime() / 1000);

        for (const cat of categories) {
          const arr = store.get(cat) ?? [];
          arr.push({ ts: nowSec, categories });
          store.set(cat, arr);
        }
      }
    }

    return trace;
  }

  // helpers 
  private matchBasicTargeting(opp: SlotOpportunity, t: any): boolean {
    // format already handled via creative type; check geo/device/slot quick filters
    if (t?.geo && opp.user.geo && !t.geo.includes(opp.user.geo)) return false;

    if (t?.device && opp.user.device && !t.device.includes(opp.user.device))
      return false;

    if (t?.slot && !t.slot.includes(opp.slotType)) return false;

    return true;
  }

  private basicTargetingScore(opp: SlotOpportunity, t: any): number {
    let s = 1;
    if (t?.geo && opp.user.geo) s *= t.geo.includes(opp.user.geo) ? 1 : 0.6;

    if (t?.device && opp.user.device)
      s *= t.device.includes(opp.user.device) ? 1 : 0.8;

    if (t?.genres && opp.content.genre)
      s *= t.genres.includes(opp.content.genre) ? 1 : 0.7;

    return Math.max(0, Math.min(1, s));
  }

  private matchDaypart(
    now: Date,
    dayparts?: Array<{ start: string; end: string }>,
  ): boolean {
    if (!dayparts || !dayparts.length) return true;

    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();

    const toMins = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return (h * 60 + m) % (24 * 60);
    };

    return dayparts.some(({ start, end }) => {
      const a = toMins(start),
        b = toMins(end);

      return a <= b ? mins >= a && mins <= b : mins >= a || mins <= b; // overnight
    });
  }

  private matchContentFacets(opp: SlotOpportunity, t: any): boolean {
    if (
      t?.services &&
      opp.content.service_id &&
      !t.services.includes(opp.content.service_id)
    )
      return false;

    if (t?.genres && opp.content.genre && !t.genres.includes(opp.content.genre))
      return false;

    if (t?.ratings && opp.content.rating) {
      // LI may declare allowed max rating; we treat as allow-list
      const ok = (t.ratings as string[]).some(
        (allowed: string) =>
          (ratingRank[opp.content.rating!] ?? 99) <=
          (ratingRank[allowed] ?? 99),
      );

      if (!ok) return false;
    }
    return true;
  }

  private creativeVsContentSafetyOk(
    contentRating?: Rating,
    creativeSafety?: string,
  ): boolean {
    if (!contentRating) return true;

    const contentRank = ratingRank[contentRating] ?? 99;

    const map: Record<string, number> = { G: 2, PG: 3, M: 5 }; // approximate mapping to TV ranks

    const creativeRank = map[(creativeSafety ?? 'G').toUpperCase()] ?? 2;

    return creativeRank <= contentRank;
  }

  private violatesSeparation(
    seps: Array<{ category: string; min_separation_min: number }>,
    ctx: AuctionContext,
  ): boolean {
    if (!seps.length) return false;

    const memory = ctx.recentWins;
    if (!memory) return false;

    const nowSec = Math.floor(Date.now() / 1000);

    for (const rule of seps) {
      const arr = memory.get(rule.category);

      if (!arr || !arr.length) continue;

      const cutoff = nowSec - rule.min_separation_min * 60;

      if (arr.some((e) => e.ts >= cutoff)) return true;
    }
    return false;
  }
}
