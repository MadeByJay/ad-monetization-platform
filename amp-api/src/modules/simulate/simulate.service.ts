import { BadRequestException, Injectable } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import { MetricsService } from '../metrics/metrics.service';
import { AuctionService } from '../auction/auction.service';
import type { SlotOpportunity, SlotType } from '../auction/auction.types';
import type { Insertable } from 'kysely';
import type { ImpressionsTable, RunsTable } from '../../types/database';

interface StartRunPayload {
  scenario_id?: string;
  content_brand_safety?: 'G' | 'PG' | 'M';
}

@Injectable()
export class SimulateService {
  constructor(
    private readonly repositories: Repositories,
    private readonly metrics: MetricsService,
    private readonly auction: AuctionService,
  ) {}

  async startRun(payload: StartRunPayload): Promise<{ run_id: string }> {
    const runId = crypto.randomUUID();

    // Resolve and validate scenario
    let scenarioId: string | null = null;
    let scenarioConfig: any | null = null;
    if (payload?.scenario_id && payload.scenario_id.trim() !== '') {
      const scenario = await this.repositories.scenarios.get(
        payload.scenario_id,
      );
      if (!scenario) throw new BadRequestException('scenario_not_found');
      scenarioId = payload.scenario_id;
      scenarioConfig =
        typeof scenario.config_json === 'string'
          ? JSON.parse(scenario.config_json as any)
          : scenario.config_json;
    }

    const runInsert: Insertable<RunsTable> = {
      id: runId,
      scenario_id: scenarioId,
      stats_json: {},
    };

    await this.repositories.runs.create(runInsert);

    const slotCycle: readonly SlotType[] = [
      'preroll',
      'midroll',
      'display',
    ] as const;

    // pick brand safety: override > scenario.config > default
    const brandSafety: 'G' | 'PG' | 'M' =
      payload.content_brand_safety ??
      scenarioConfig?.content?.brandSafety ??
      'G';

    const opportunities: SlotOpportunity[] = Array.from({ length: 60 }).map(
      (_, index) => {
        const slotType: SlotType = slotCycle[index % slotCycle.length];
        const device: 'desktop' | 'mobile' =
          index % 2 === 0 ? 'desktop' : 'mobile';
        const geo =
          index % 4 === 0
            ? 'US'
            : index % 4 === 1
              ? 'IN'
              : index % 4 === 2
                ? 'GB'
                : 'CA';
        const userId = `${device}_${geo}`;
        const tags = index % 2 === 0 ? ['tech'] : ['news'];
        return {
          slotType,
          user: { device, geo, userId },
          content: { tags, brandSafety },
          ts: new Date(),
        };
      },
    );
    const rows: Insertable<ImpressionsTable>[] = [];

    for (const opportunity of opportunities) {
      const trace = await this.auction.run(opportunity);
      const winner = trace.winner;
      const winningScore = winner
        ? trace.scored.find(
            (s) =>
              s.creativeId === winner.creativeId &&
              s.campaignId === winner.campaignId,
          )
        : undefined;
      const cpmBid = winningScore?.cpmBid ?? 0;
      const revenue = cpmBid / 1000;

      rows.push({
        id: crypto.randomUUID(),
        run_id: runId,
        slot_type: opportunity.slotType,
        campaign_id: winner?.campaignId ?? null,
        creative_id: winner?.creativeId ?? null,
        cpm: cpmBid,
        revenue,
        user_id: opportunity.user.userId!,
        context_json: { user: opportunity.user, content: opportunity.content },
        trace_json: trace,
      });

      this.metrics.impressionsTotal
        .labels(opportunity.slotType, winner?.campaignId ?? 'none')
        .inc();
      this.metrics.revenueTotal.labels(opportunity.slotType).inc(revenue);
    }

    await this.repositories.impressions.bulkInsert(rows);

    const revenue = rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
    const fillRate = rows.filter((r) => r.campaign_id).length / rows.length;
    await this.repositories.runs.finish(runId, {
      fill_rate: fillRate,
      revenue,
      average_cpm: 2.5,
    });
    return { run_id: runId };
  }

  async getRun(runId: string) {
    const run = await this.repositories.runs.get(runId);
    const impressions = await this.repositories.impressions.listByRun(runId);
    return { run, impressions };
  }

  async listRuns(limit = 50) {
    const runs = await this.repositories.runs.listLatest(limit);
    return { runs };
  }

  async getRunSummary(runId: string) {
    const run = await this.repositories.runs.get(runId);

    if (!run) return { error: 'run_not_found' };

    const impressions = await this.repositories.impressions.listByRun(runId);
    const total = impressions.length || 1;
    const delivered = impressions.filter((i) => !!i.campaign_id);
    const deliveredCount = delivered.length;
    const fillRate = Number((deliveredCount / total).toFixed(4));
    const revenue = Number(
      impressions.reduce((s, r) => s + Number(r.revenue ?? 0), 0).toFixed(6),
    );
    const avgCpmDelivered = deliveredCount
      ? Number(
          (
            delivered.reduce((s, r) => s + Number(r.cpm ?? 0), 0) /
            deliveredCount
          ).toFixed(4),
        )
      : 0;

    // spend per campaign
    const spendByCampaign: Record<
      string,
      { impressions: number; revenue: number }
    > = {};
    // winners by slot
    const winnersBySlot: Record<string, Record<string, number>> = {};
    // stacked drop reasons
    const dropReasons: Record<string, number> = {};
    // minute-bucket spend over time
    const spendOverTime: Record<string, number> = {};

    for (const row of impressions) {
      const ts = (row as any).ts ? new Date((row as any).ts) : null;

      const bucket = ts
        ? new Date(
            ts.getFullYear(),
            ts.getMonth(),
            ts.getDate(),
            ts.getHours(),
            ts.getMinutes(),
            0,
          ).toISOString()
        : 'unknown';
      spendOverTime[bucket] =
        (spendOverTime[bucket] ?? 0) + Number(row.revenue ?? 0);

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
        const cid = row.campaign_id as string;
        spendByCampaign[cid] ??= { impressions: 0, revenue: 0 };
        spendByCampaign[cid].impressions += 1;
        spendByCampaign[cid].revenue += Number(row.revenue ?? 0);

        winnersBySlot[row.slot_type] ??= {};
        winnersBySlot[row.slot_type][cid] =
          (winnersBySlot[row.slot_type][cid] ?? 0) + 1;
      }
    }

    for (const k of Object.keys(spendByCampaign))
      spendByCampaign[k].revenue = Number(
        spendByCampaign[k].revenue.toFixed(6),
      );

    return {
      run: {
        ...run,
        stats_json:
          typeof run.stats_json === 'string'
            ? JSON.parse(run.stats_json as any)
            : run.stats_json,
      },
      summary: {
        total_impressions: total,
        delivered_impressions: deliveredCount,
        fill_rate: fillRate,
        revenue_total: revenue,
        average_cpm_delivered: avgCpmDelivered,
        spend_by_campaign: spendByCampaign,
        drop_reasons: dropReasons,
        slot_mix: impressions.reduce(
          (acc: any, r) => (
            (acc[r.slot_type] = (acc[r.slot_type] ?? 0) + 1),
            acc
          ),
          {},
        ),
        spend_over_time: spendOverTime,
        winners_by_slot: winnersBySlot,
      },
    };
  }

  async getRunImpressions(runId: string, offset = 0, limit = 50) {
    const all = await this.repositories.impressions.listByRun(runId);
    const slice = all.slice(offset, offset + limit);
    const total = all.length;
    return { total, offset, limit, items: slice };
  }

  async exportRunJson(runId: string) {
    const data = await this.getRun(runId);
    return data;
  }

  async exportRunCsv(
    runId: string,
  ): Promise<{ filename: string; content: string }> {
    const { run, impressions } = await this.getRun(runId);
    if (!run)
      return { filename: `run-${runId}.csv`, content: 'error,run_not_found\n' };

    const headers = [
      'id',
      'slot_type',
      'ts',
      'campaign_id',
      'creative_id',
      'cpm',
      'revenue',
      'user_id',
      'drop_reasons',
    ];
    const lines = [headers.join(',')];

    for (const row of impressions) {
      const ts = (row as any).ts ? new Date((row as any).ts).toISOString() : '';
      const trace =
        typeof row.trace_json === 'string'
          ? JSON.parse(row.trace_json as any)
          : (row.trace_json as any);
      const reasons = Array.isArray(trace?.dropped)
        ? trace.dropped.map((d: any) => d.reason).join('|')
        : '';
      const csv = [
        row.id,
        row.slot_type,
        ts,
        row.campaign_id ?? '',
        row.creative_id ?? '',
        row.cpm ?? '',
        row.revenue ?? '',
        row.user_id ?? '',
        reasons,
      ]
        .map((v) => {
          const s = String(v ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',');
      lines.push(csv);
    }

    return { filename: `run-${runId}.csv`, content: lines.join('\n') };
  }
}
