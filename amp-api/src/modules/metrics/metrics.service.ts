import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';

function getOrCreateCounter<TLabel extends string>(
  name: string,
  help: string,
  labelNames: readonly TLabel[],
): Counter<TLabel> {
  const existing = register.getSingleMetric(name) as
    | Counter<TLabel>
    | undefined;
  return existing ?? new Counter<TLabel>({ name, help, labelNames });
}

@Injectable()
export class MetricsService {
  readonly impressionsTotal = getOrCreateCounter(
    'sim_impressions_total',
    'Total simulated impressions',
    ['slot_type', 'campaign_id'] as const,
  );

  readonly revenueTotal = getOrCreateCounter(
    'sim_revenue_total',
    'Total simulated revenue',
    ['slot_type'] as const,
  );

  readonly eligibilityDroppedTotal = getOrCreateCounter(
    'sim_auction_eligibility_dropped_total',
    'Count of eligibility drops by reason',
    ['reason'] as const,
  );
}
