import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repositories } from '../../repositories/repositories';

@Injectable()
export class RollupsService {
  private readonly logger = new Logger('RollupsService');

  constructor(private readonly repositories: Repositories) {}

  /** Compute and store rollups for a single run (called on run finish) */
  async computeAndStoreForRun(runId: string): Promise<void> {
    // Spend over time from DB (minute buckets)
    const spendOverTime =
      await this.repositories.rollups.spendOverTimeFromDb(runId);

    // Top facets from existing summary logic (reuse reads)
    const { summary } = await this.summaryForRun(runId);

    const topFacets = {
      spend_by_campaign: summary?.spend_by_campaign ?? {},
      drop_reasons: summary?.drop_reasons ?? {},
      slot_mix: summary?.slot_mix ?? {},
    };

    await this.repositories.rollups.upsertRunRollup(
      runId,
      spendOverTime,
      topFacets,
    );
    this.logger.log(`Rollups stored for run ${runId}`);
  }

  /** Lightweight summary (reuse repository reads) */
  private async summaryForRun(runId: string) {
    // Call the already-implemented service path (simulateService) would create cycles.
    // So we do minimal aggregation from impressions here.
    const impressions = await this.repositories.impressions.listByRun(runId);

    const spendByCampaign: Record<
      string,
      { impressions: number; revenue: number }
    > = {};
    const dropReasons: Record<string, number> = {};
    const slotMix: Record<string, number> = {};

    for (const row of impressions) {
      slotMix[row.slot_type] = (slotMix[row.slot_type] ?? 0) + 1;

      const trace =
        typeof row.trace_json === 'string'
          ? JSON.parse(row.trace_json as any)
          : (row.trace_json as any);

      const dropped: Array<{ reason: string }> = Array.isArray(trace?.dropped)
        ? trace.dropped
        : [];

      for (const { reason } of dropped)
        dropReasons[reason] = (dropReasons[reason] ?? 0) + 1;

      if (row.campaign_id) {
        const key = row.campaign_id as string;
        spendByCampaign[key] ??= { impressions: 0, revenue: 0 };
        spendByCampaign[key].impressions += 1;
        spendByCampaign[key].revenue += Number(row.revenue ?? 0);
      }
    }

    for (const k of Object.keys(spendByCampaign)) {
      spendByCampaign[k].revenue = Number(
        spendByCampaign[k].revenue.toFixed(6),
      );
    }

    return {
      summary: {
        spend_by_campaign: spendByCampaign,
        drop_reasons: dropReasons,
        slot_mix: slotMix,
      },
    };
  }

  /** Nightly backfill: recompute missing or stale rollups */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async backfillNightly() {
    // Simple strategy: recompute last 200 runs
    const recentRuns = await this.repositories.runs.listLatest(200);

    for (const run of recentRuns) {
      try {
        await this.computeAndStoreForRun(run.id);
      } catch (error) {
        this.logger.warn(
          `Rollup failed for ${run.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
