import { Injectable } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import { TargetingService } from './targeting.service';
import { PacingService } from '../pacing/pacing.service';
import { MetricsService } from '../metrics/metrics.service';
import { FrequencyService } from '../frequency/frequency.service';
import type { AuctionTrace, SlotOpportunity } from './auction.types';

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
  private readonly floorPriceCpm = Math.max(
    0,
    Number(process.env.FLOOR_PRICE_CPM ?? 0),
  ); // e.g., 0 → no floor
  private readonly allowedBrandSafety: Set<string> = new Set(
    (process.env.BRAND_SAFETY_ALLOW ?? 'G,PG')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );

  constructor(
    private readonly repositories: Repositories,
    private readonly targeting: TargetingService,
    private readonly pacing: PacingService,
    private readonly metrics: MetricsService,
    private readonly frequency: FrequencyService,
  ) {}

  private priorityMultiplier(priority: number): number {
    return 1 + (Math.min(Math.max(priority, 1), 10) - 1) * 0.0555556;
  }

  async run(opportunity: SlotOpportunity): Promise<AuctionTrace> {
    const campaigns = await this.repositories.campaigns.list();
    const creatives = await this.repositories.creatives.list();

    const trace: AuctionTrace = {
      slotType: opportunity.slotType,
      eligibleCampaignIds: [],
      dropped: [],
      scored: [],
    };

    for (const campaign of campaigns) {
      if (!campaign.active) {
        trace.dropped.push({ reason: 'inactive', campaignId: campaign.id });
        this.metrics.eligibilityDroppedTotal.labels('inactive').inc();
        continue;
      }

      const formats: string[] = Array.isArray(campaign.formats_json)
        ? (campaign.formats_json as any)
        : [];
      if (!formats.includes(opportunity.slotType)) {
        trace.dropped.push({
          reason: 'format_mismatch',
          campaignId: campaign.id,
        });
        this.metrics.eligibilityDroppedTotal.labels('format_mismatch').inc();
        continue;
      }

      const mediaType =
        opportunity.slotType === 'display' ? 'display' : 'video';
      const candidateCreatives = creatives.filter(
        (c) => c.campaign_id === campaign.id && c.type === mediaType,
      );
      if (candidateCreatives.length === 0) {
        trace.dropped.push({ reason: 'no_creatives', campaignId: campaign.id });
        this.metrics.eligibilityDroppedTotal.labels('no_creatives').inc();
        continue;
      }

      // Frequency cap
      const userId =
        opportunity.user.userId ??
        `${opportunity.user.device ?? 'unknown'}_${opportunity.user.geo ?? 'NA'}`;
      const freqCap = Number(campaign.freq_cap_user_day || 0);
      const freqDecision = await this.frequency.check({
        campaignId: campaign.id,
        userId,
        capPerUserPerDay: freqCap,
        now: opportunity.ts,
      });
      if (!freqDecision.eligible) {
        trace.dropped.push({ reason: 'frequency', campaignId: campaign.id });
        this.metrics.eligibilityDroppedTotal.labels('frequency').inc();
        continue;
      }

      // Pacing / budget
      const pacingDecision = await this.pacing.check({
        campaignId: campaign.id,
        dailyBudget: Number(campaign.daily_budget),
        pacingStrategy: (campaign.pacing_strategy as 'even' | 'asap') || 'even',
        now: opportunity.ts,
      });
      if (!pacingDecision.eligible) {
        trace.dropped.push({ reason: 'budget', campaignId: campaign.id });
        this.metrics.eligibilityDroppedTotal.labels('budget').inc();
        continue;
      }

      trace.eligibleCampaignIds.push(campaign.id);

      const { score: targetingScore } = this.targeting.scoreCampaign(
        opportunity,
        campaign.targeting_json,
      );
      const priorityMultiplier = this.priorityMultiplier(campaign.priority);
      const pacingMultiplier = pacingDecision.pacingMultiplier;

      for (const creative of candidateCreatives) {
        const cpmBid = Number(campaign.cpm_bid);

        // Floor price check
        if (this.floorPriceCpm > 0 && cpmBid < this.floorPriceCpm) {
          trace.dropped.push({ reason: 'floor', campaignId: campaign.id });
          this.metrics.eligibilityDroppedTotal.labels('floor').inc();
          continue;
        }

        // Brand safety check
        const creativeRating = (creative.brand_safety ?? 'G').toUpperCase();
        const contentRating = (
          opportunity.content.brandSafety ?? 'G'
        ).toUpperCase();
        // Rule: creative AND content must be allowed by allowlist.
        if (
          !this.allowedBrandSafety.has(creativeRating) ||
          !this.allowedBrandSafety.has(contentRating)
        ) {
          trace.dropped.push({
            reason: 'brand_safety',
            campaignId: campaign.id,
          });
          this.metrics.eligibilityDroppedTotal.labels('brand_safety').inc();
          continue;
        }

        const finalScore =
          cpmBid * priorityMultiplier * targetingScore * pacingMultiplier;
        if (pacingMultiplier < 1) {
          trace.dropped.push({
            reason: 'pacing_overspend',
            campaignId: campaign.id,
          });
          this.metrics.eligibilityDroppedTotal.labels('pacing_overspend').inc();
        }
        trace.scored.push({
          campaignId: campaign.id,
          creativeId: creative.id,
          cpmBid,
          priorityMultiplier,
          targetingScore,
          pacingMultiplier,
          finalScore,
        });
      }
    }

    // Winner with deterministic tiebreak
    if (trace.scored.length > 0) {
      const eps = 1e-9;
      trace.scored.sort((a, b) => {
        const d = b.finalScore - a.finalScore;
        if (Math.abs(d) > eps) return d > 0 ? 1 : -1;
        // tie → deterministic hash on creative+time
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
    }

    return trace;
  }
}
