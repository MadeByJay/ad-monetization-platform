import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

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

function getOrCreateHistogram<TLabel extends string>(
  name: string,
  help: string,
  labelNames: readonly TLabel[],
  buckets?: number[],
) {
  const existing = register.getSingleMetric(name) as Histogram<TLabel>;
  return existing ?? new Histogram<TLabel>({ name, help, labelNames, buckets });
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

  readonly auctionLatencySeconds = getOrCreateHistogram(
    'sim_auction_latency_seconds',
    'Auction latency per opportunity',
    [] as const,
    [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1],
  );

  readonly dbInsertBatchDurationSeconds = getOrCreateHistogram(
    'sim_db_insert_batch_duration_seconds',
    'Duration of a DB bulk insert batch',
    ['table'] as const,
    [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1],
  );

  readonly dbInsertBatchesTotal = getOrCreateCounter(
    'sim_insert_batches_total',
    'Number of insert batches executed',
    ['table'] as const,
  );
}
