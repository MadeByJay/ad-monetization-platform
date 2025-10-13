import { Injectable } from '@nestjs/common';
import type { SlotOpportunity } from './auction.types';

// Very simple 0..1 targeting score. Extend later
@Injectable()
export class TargetingService {
  scoreCampaign(
    opportunity: SlotOpportunity,
    campaignTargeting: any,
  ): { score: number } {
    let score = 1;
    if (campaignTargeting?.geo && opportunity.user.geo) {
      score *= campaignTargeting.geo.includes(opportunity.user.geo) ? 1 : 0.3;
    }
    if (campaignTargeting?.device && opportunity.user.device) {
      score *= campaignTargeting.device.includes(opportunity.user.device)
        ? 1
        : 0.6;
    }
    if (campaignTargeting?.contentTags && opportunity.content.tags?.length) {
      const overlap = opportunity.content.tags.filter((t) =>
        campaignTargeting.contentTags.includes(t),
      ).length;
      score *= overlap > 0 ? 1 : 0.7;
    }
    return { score: Math.max(0, Math.min(1, score)) };
  }
}
