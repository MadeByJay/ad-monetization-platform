import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DimensionFilters,
  Repositories,
} from '../../repositories/repositories';
import { MetricsService } from '../metrics/metrics.service';
import { AuctionService } from '../auction/auction.service';
import type { SlotOpportunity, SlotType } from '../auction/auction.types';
import type { Insertable } from 'kysely';
import type { ImpressionsTable, RunsTable } from '../../types/database';
import { RollupsService } from '../rollups/rollups.service';

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
    private readonly rollups: RollupsService,
  ) {}

  /**
   * Start a simulation run. Generates synthetic opportunities enriched with real
   * inventory identifiers (network/channel/series/season/episode/service),
   * calls the auction for each, stores impressions in batches via repositories,
   * and writes rollups at the end.
   */
  async startRun(payload: StartRunPayload): Promise<{ run_id: string }> {
    const runId = crypto.randomUUID();

    // Optional scenario: validate and load config (for brand-safety override, etc.)
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
          : (scenario.config_json as any);
    }

    // Create run row (DB write via repository; timestamps are DB defaults)
    const runInsert: Insertable<RunsTable> = {
      id: runId,
      scenario_id: scenarioId,
      stats_json: {},
    };
    await this.repositories.runs.create(runInsert);

    // Build a small inventory cache for this run so content ids in opportunities are real.
    const inventoryTree = await this.repositories.inventory.tree();
    const flattenedEpisodes: Array<{
      series_id: string;
      season_id: string;
      episode_id: string;
      genre?: string;
      rating?: string;
    }> = [];

    //TODO - Refactor using sets, if possible
    for (const series of inventoryTree.series ?? []) {
      for (const season of series.seasons ?? []) {
        for (const episode of season.episodes ?? []) {
          flattenedEpisodes.push({
            series_id: series.id,
            season_id: season.id,
            episode_id: episode.id,
            genre: series.genre ?? undefined,
            rating: series.rating ?? undefined,
          });
        }
      }
    }

    const networkChoices = inventoryTree.networks ?? [];
    const serviceChoices = inventoryTree.services ?? [];

    // Determine content brand safety used by the run (override > scenario > default)
    const contentBrandSafety: 'G' | 'PG' | 'M' =
      payload.content_brand_safety ??
      scenarioConfig?.content?.brandSafety ??
      'G';

    // Generate synthetic opportunities (mix of preroll/midroll/display), attaching real inventory ids
    const slotCycle: readonly SlotType[] = [
      'preroll',
      'midroll',
      'display',
    ] as const;
    const rowsToInsert: Insertable<ImpressionsTable>[] = [];

    // In-run memory for competitive separation policy (category -> recent wins)
    let policyRecentWinsMemory:
      | Map<string, Array<{ ts: number; categories: string[] }>>
      | undefined;

    const totalOpportunities = 60;
    for (
      let opportunityIndex = 0;
      opportunityIndex < totalOpportunities;
      opportunityIndex++
    ) {
      const slotType: SlotType = slotCycle[opportunityIndex % slotCycle.length];
      const positionInPod =
        slotType === 'preroll'
          ? 1
          : slotType === 'midroll'
            ? (opportunityIndex % 2) + 1
            : 0;

      const deviceType: 'desktop' | 'mobile' =
        opportunityIndex % 2 === 0 ? 'desktop' : 'mobile';
      const geoCountry =
        opportunityIndex % 4 === 0
          ? 'US'
          : opportunityIndex % 4 === 1
            ? 'IN'
            : opportunityIndex % 4 === 2
              ? 'GB'
              : 'CA';
      const userIdentifier = `${deviceType}_${geoCountry}`;

      const chosenEpisode =
        flattenedEpisodes[
          opportunityIndex % Math.max(1, flattenedEpisodes.length)
        ];
      const chosenNetwork =
        networkChoices[opportunityIndex % Math.max(1, networkChoices.length)];
      const chosenChannels = chosenNetwork?.channels ?? [];
      const chosenChannel =
        chosenChannels.length > 0
          ? chosenChannels[opportunityIndex % chosenChannels.length]
          : undefined;
      const chosenService =
        serviceChoices[opportunityIndex % Math.max(1, serviceChoices.length)];

      const contentGenre =
        chosenEpisode?.genre ??
        (opportunityIndex % 3 === 0
          ? 'Sci-Fi'
          : opportunityIndex % 3 === 1
            ? 'Comedy'
            : 'Crime');
      const contentIndustryRating =
        (chosenEpisode?.rating as any) ??
        (opportunityIndex % 3 === 0
          ? 'TV-PG'
          : opportunityIndex % 3 === 1
            ? 'TV-14'
            : 'TV-MA');

      const contentTags = opportunityIndex % 2 === 0 ? ['tech'] : ['news'];

      const opportunity: SlotOpportunity = {
        slotType,
        user: { device: deviceType, geo: geoCountry, userId: userIdentifier },
        content: {
          tags: contentTags,
          brandSafety: contentBrandSafety,
          service_id: chosenService?.id,
          network_id: chosenNetwork?.id,
          channel_id: chosenChannel?.id,
          series_id: chosenEpisode?.series_id,
          season_id: chosenEpisode?.season_id,
          episode_id: chosenEpisode?.episode_id,
          genre: contentGenre,
          rating: contentIndustryRating as any,
        },
        ts: new Date(),
        pod: positionInPod ? { position: positionInPod } : undefined,
      };

      // Call auction with timing to record latency histogram
      const auctionContext = { runId, recentWins: policyRecentWinsMemory };
      const startTime = performance.now();
      const auctionTrace = await this.auction.run(
        opportunity,
        auctionContext as any,
      );
      const endTime = performance.now();
      this.metrics.auctionLatencySeconds.observe((endTime - startTime) / 1000);

      // Persist in-run memory changes made by auction (for competitive separation)
      policyRecentWinsMemory =
        auctionContext.recentWins ?? policyRecentWinsMemory;

      // Determine winning line item / creative and compute CPM / revenue
      const winning = auctionTrace.winner;
      const winningScoreRow = winning
        ? auctionTrace.scored.find(
            (s) =>
              s.creativeId === winning.creativeId &&
              s.campaignId === winning.campaignId,
          )
        : undefined;
      const cpmBid = winningScoreRow?.cpmBid ?? 0;
      const revenue = cpmBid / 1000;

      // Accumulate impression row (DB write is batched below via repository)
      rowsToInsert.push({
        id: crypto.randomUUID(),
        run_id: runId,
        slot_type: opportunity.slotType,
        campaign_id: winning?.campaignId ?? null, // surface Line Item id as campaign_id during migration
        creative_id: winning?.creativeId ?? null,
        cpm: cpmBid,
        revenue,
        user_id: userIdentifier,
        context_json: {
          user: opportunity.user,
          content: opportunity.content,
          pod: opportunity.pod,
        },
        trace_json: auctionTrace,
      });

      // Metrics
      this.metrics.impressionsTotal
        .labels(opportunity.slotType, winning?.campaignId ?? 'none')
        .inc();
      this.metrics.revenueTotal.labels(opportunity.slotType).inc(revenue);
    }

    // Bulk insert impressions in batches (repositories handle batching + metrics)
    await this.repositories.impressions.bulkInsert(rowsToInsert);

    // Compute aggregates for run stats, store on run
    const totalRevenue = rowsToInsert.reduce(
      (sum, row) => sum + (row.revenue ?? 0),
      0,
    );
    const deliveredCount = rowsToInsert.filter((r) => !!r.campaign_id).length;
    const fillRate = rowsToInsert.length
      ? deliveredCount / rowsToInsert.length
      : 0;

    await this.repositories.runs.finish(runId, {
      fill_rate: Number(fillRate.toFixed(4)),
      revenue: Number(totalRevenue.toFixed(6)),
      average_cpm: 2.5, // placeholder; real average CPM can be derived from delivered if needed
    });

    // Compute and store rollups immediately (for sub-second results dashboards)
    await this.rollups.computeAndStoreForRun(runId);

    return { run_id: runId };
  }

  /**
   * Scoped variant of startRun.
   * Stamps account and user identifiers on the run and impressions,
   * and otherwise mirrors the unscoped startRun logic.
   */
  async startRunScoped(
    payload: { scenario_id?: string; content_brand_safety?: 'G' | 'PG' | 'M' },
    user: { account_id: string; user_id: string } | null,
  ): Promise<{ run_id: string }> {
    // Resolve account and user identifiers (fallback to default account)
    const defaultAccount =
      await this.repositories.accounts.getBySlug('default');

    const accountId = user?.account_id ?? defaultAccount?.id;

    if (!accountId) throw new BadRequestException('missing_account');

    const createdByUserId = user?.user_id ?? null;

    const runId = crypto.randomUUID();

    // Optional scenario validation (scoped by account)
    let scenarioId: string | null = null;
    let scenarioConfig: any | null = null;

    if (payload?.scenario_id && payload.scenario_id.trim() !== '') {
      const scopedScenario = await this.repositories.scenariosScoped.get(
        accountId,
        payload.scenario_id,
      );

      if (!scopedScenario) throw new BadRequestException('scenario_not_found');
      scenarioId = payload.scenario_id;
      scenarioConfig =
        typeof scopedScenario.config_json === 'string'
          ? JSON.parse(scopedScenario.config_json as any)
          : (scopedScenario.config_json as any);
    }

    // Create run row with account scope
    await this.repositories.runsScoped.create({
      id: runId,
      scenario_id: scenarioId,
      stats_json: {},
      account_id: accountId,
      created_by_user_id: createdByUserId,
      started_at: undefined as any,
      finished_at: null as any,
    });

    // Build inventory cache for realistic identifiers in opportunities
    const inventoryTree = await this.repositories.inventory.tree();
    const flattenedEpisodes: Array<{
      series_id: string;
      season_id: string;
      episode_id: string;
      genre?: string;
      rating?: string;
    }> = [];
    //TODO - Refactor using sets
    for (const series of inventoryTree.series ?? []) {
      for (const season of series.seasons ?? []) {
        for (const episode of season.episodes ?? []) {
          flattenedEpisodes.push({
            series_id: series.id,
            season_id: season.id,
            episode_id: episode.id,
            genre: series.genre ?? "",
            rating: series.rating ?? "",
          });
        }
      }
    }
    const networkChoices = inventoryTree.networks ?? [];
    const serviceChoices = inventoryTree.services ?? [];

    // Brand safety to stamp on opportunities
    const contentBrandSafety: 'G' | 'PG' | 'M' =
      payload.content_brand_safety ??
      scenarioConfig?.content?.brandSafety ??
      'G';

    const slotCycle: readonly SlotType[] = [
      'preroll',
      'midroll',
      'display',
    ] as const;

    const rowsToInsert: Insertable<ImpressionsTable>[] = [];

    let policyRecentWinsMemory:
      | Map<string, Array<{ ts: number; categories: string[] }>>
      | undefined;

    const totalOpportunities = 60;

    for (
      let opportunityIndex = 0;
      opportunityIndex < totalOpportunities;
      opportunityIndex++
    ) {
      const slotType: SlotType = slotCycle[opportunityIndex % slotCycle.length];

      const positionInPod =
        slotType === 'preroll'
          ? 1
          : slotType === 'midroll'
            ? (opportunityIndex % 2) + 1
            : 0;

      const deviceType: 'desktop' | 'mobile' =
        opportunityIndex % 2 === 0 ? 'desktop' : 'mobile';

      const geoCountry =
        opportunityIndex % 4 === 0
          ? 'US'
          : opportunityIndex % 4 === 1
            ? 'IN'
            : opportunityIndex % 4 === 2
              ? 'GB'
              : 'CA';

      const userIdentifier = `${deviceType}_${geoCountry}`;

      const chosenEpisode =
        flattenedEpisodes[
          opportunityIndex % Math.max(1, flattenedEpisodes.length)
        ];

      const chosenNetwork =
        networkChoices[opportunityIndex % Math.max(1, networkChoices.length)];

      const chosenChannels = chosenNetwork?.channels ?? [];

      const chosenChannel =
        chosenChannels.length > 0
          ? chosenChannels[opportunityIndex % chosenChannels.length]
          : null;

      const chosenService =
        serviceChoices[opportunityIndex % Math.max(1, serviceChoices.length)];

      const contentGenre =
        chosenEpisode?.genre ??
        (opportunityIndex % 3 === 0
          ? 'Sci-Fi'
          : opportunityIndex % 3 === 1
            ? 'Comedy'
            : 'Crime');

      const contentIndustryRating =
        (chosenEpisode?.rating as any) ??
        (opportunityIndex % 3 === 0
          ? 'TV-PG'
          : opportunityIndex % 3 === 1
            ? 'TV-14'
            : 'TV-MA');

      const contentTags = opportunityIndex % 2 === 0 ? ['tech'] : ['news'];

      const opportunity: SlotOpportunity = {
        slotType,
        user: { device: deviceType, geo: geoCountry, userId: userIdentifier },
        content: {
          tags: contentTags,
          brandSafety: contentBrandSafety,
          service_id: chosenService?.id,
          network_id: chosenNetwork?.id,
          channel_id: chosenChannel?.id,
          series_id: chosenEpisode?.series_id,
          season_id: chosenEpisode?.season_id,
          episode_id: chosenEpisode?.episode_id,
          genre: contentGenre,
          rating: contentIndustryRating as any,
        },
        ts: new Date(),
        pod: positionInPod ? { position: positionInPod } : undefined,
      };

      const auctionContext = { runId, recentWins: policyRecentWinsMemory };
      const startTime = performance.now();
      const auctionTrace = await this.auction.run(
        opportunity,
        auctionContext as any,
      );

      const endTime = performance.now();

      this.metrics.auctionLatencySeconds.observe((endTime - startTime) / 1000);
      policyRecentWinsMemory =
        auctionContext.recentWins ?? policyRecentWinsMemory;

      const winning = auctionTrace.winner;
      const winningScoreRow = winning
        ? auctionTrace.scored.find(
            (s) =>
              s.creativeId === winning.creativeId &&
              s.campaignId === winning.campaignId,
          )
        : null;
      const cpmBid = winningScoreRow?.cpmBid ?? 0;
      const revenue = cpmBid / 1000;

      rowsToInsert.push({
        id: crypto.randomUUID(),
        run_id: runId,
        slot_type: opportunity.slotType,
        campaign_id: winning?.campaignId ?? null,
        creative_id: winning?.creativeId ?? null,
        cpm: cpmBid,
        revenue,
        user_id: userIdentifier,
        context_json: {
          user: opportunity.user,
          content: opportunity.content,
          pod: opportunity.pod,
        },
        trace_json: auctionTrace,
        account_id: accountId,
      });

      this.metrics.impressionsTotal
        .labels(opportunity.slotType, winning?.campaignId ?? 'none')
        .inc();
      this.metrics.revenueTotal.labels(opportunity.slotType).inc(revenue);
    }

    await this.repositories.impressions.bulkInsert(rowsToInsert);

    const totalRevenue = rowsToInsert.reduce(
      (sum, row) => sum + (row.revenue ?? 0),
      0,
    );

    const deliveredCount = rowsToInsert.filter((r) => !!r.campaign_id).length;

    const fillRate = rowsToInsert.length
      ? deliveredCount / rowsToInsert.length
      : 0;

    await this.repositories.runs.finish(runId, {
      fill_rate: Number(fillRate.toFixed(4)),
      revenue: Number(totalRevenue.toFixed(6)),
      average_cpm: 2.5,
    });

    await this.rollups.computeAndStoreForRun(runId);

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

  /**
   * Compute a summary over a run, honoring dimension/content filters.
   * Uses repository-level filtered reads so the DB does the heavy lifting.
   * Summary endpoint (prefers rollups when no filters are applied).
   * - If no filters: use run_rollups + a couple of quick counts.
   * - If filters present: compute filtered summary from raw impressions.
   */
  async getRunSummary(runId: string, filters?: DimensionFilters) {
    const run = await this.repositories.runs.get(runId);
    if (!run) return { error: 'run_not_found' };

    const filtersAreEmpty =
      !filters ||
      Object.values(filters).every((v) => v === undefined || v === '');

    // Prefer rollups when unfiltered
    if (filtersAreEmpty) {
      const rollupRow = await this.repositories.rollups.getRunRollup(runId);

      if (rollupRow) {
        // Use quick counts + run stats for top-line KPIs
        const stats =
          typeof run.stats_json === 'string'
            ? JSON.parse(run.stats_json as any)
            : (run.stats_json as any);

        // total/delivered/avg CPM from small queries (cheap)
        const { total, delivered } =
          await this.repositories.impressionsQuick.countTotals(runId);

        const averageCpmDelivered =
          stats?.average_cpm ??
          (await this.repositories.impressionsQuick.averageCpmDelivered(runId));

        // Revenue + facet charts from rollup
        const spendOverTime =
          typeof rollupRow.spend_over_time_json === 'string'
            ? JSON.parse(rollupRow.spend_over_time_json as any)
            : (rollupRow.spend_over_time_json as any);

        const topFacets =
          typeof rollupRow.top_facets_json === 'string'
            ? JSON.parse(rollupRow.top_facets_json as any)
            : (rollupRow.top_facets_json as any);

        const revenueTotal = Number(
          Object.values(spendOverTime).reduce(
            (s: number, v: any) => s + Number(v ?? 0),
            0,
          ),
        );

        return {
          run: {
            ...run,
            stats_json: stats,
          },
          summary: {
            total_impressions: total,
            delivered_impressions: delivered,
            fill_rate: Number(
              (stats?.fill_rate ?? delivered / Math.max(1, total)).toFixed(4),
            ),
            revenue_total: Number((stats?.revenue ?? revenueTotal).toFixed(6)),
            average_cpm_delivered: Number(
              (averageCpmDelivered ?? 0).toFixed(4),
            ),
            spend_by_campaign: topFacets?.spend_by_campaign ?? {},
            drop_reasons: topFacets?.drop_reasons ?? {},
            slot_mix: topFacets?.slot_mix ?? {},
            spend_over_time: spendOverTime,
            winners_by_slot: {}, // winners_by_slot is not in rollups - kept empty in rollup path
          },
        };
      }
      // else: fall through to filtered/full compute path below
    }

    // Fallback: filtered/full compute using the DB (previous logic)
    const impressions = await this.repositories.impressions.listByRunFiltered(
      runId,
      filters,
    );

    const totalImpressions = impressions.length || 1;
    const deliveredImpressions = impressions.filter((i) => !!i.campaign_id);
    const deliveredCount = deliveredImpressions.length;

    const fillRate = Number((deliveredCount / totalImpressions).toFixed(4));
    const revenueTotal = Number(
      impressions
        .reduce((sum, r) => sum + Number(r.revenue ?? 0), 0)
        .toFixed(6),
    );
    const averageCpmDelivered = deliveredCount
      ? Number(
          (
            deliveredImpressions.reduce(
              (sum, r) => sum + Number(r.cpm ?? 0),
              0,
            ) / deliveredCount
          ).toFixed(4),
        )
      : 0;

    const spendByCampaign: Record<
      string,
      { impressions: number; revenue: number }
    > = {};
    const winnersBySlot: Record<string, Record<string, number>> = {};
    const dropReasons: Record<string, number> = {};
    const spendOverTime: Record<string, number> = {};

    for (const row of impressions) {
      const ts = (row as any).ts ? new Date((row as any).ts) : null;
      const bucketKey = ts
        ? new Date(
            ts.getFullYear(),
            ts.getMonth(),
            ts.getDate(),
            ts.getHours(),
            ts.getMinutes(),
            0,
          ).toISOString()
        : 'unknown';

      spendOverTime[bucketKey] =
        (spendOverTime[bucketKey] ?? 0) + Number(row.revenue ?? 0);

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

        winnersBySlot[row.slot_type] ??= {};
        winnersBySlot[row.slot_type][key] =
          (winnersBySlot[row.slot_type][key] ?? 0) + 1;
      }
    }
    for (const k of Object.keys(spendByCampaign)) {
      spendByCampaign[k].revenue = Number(
        spendByCampaign[k].revenue.toFixed(6),
      );
    }

    return {
      run: {
        ...run,
        stats_json:
          typeof run.stats_json === 'string'
            ? JSON.parse(run.stats_json as any)
            : run.stats_json,
      },
      summary: {
        total_impressions: totalImpressions,
        delivered_impressions: deliveredCount,
        fill_rate: fillRate,
        revenue_total: revenueTotal,
        average_cpm_delivered: averageCpmDelivered,
        spend_by_campaign: spendByCampaign,
        drop_reasons: dropReasons,
        slot_mix: impressions.reduce(
          (acc: any, r) => {
            acc[r.slot_type] = (acc[r.slot_type] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        spend_over_time: spendOverTime,
        winners_by_slot: winnersBySlot,
      },
    };
  }

  // Paged, filtered impressions (for trace viewer)
  async getRunImpressions(
    runId: string,
    offset = 0,
    limit = 50,
    filters?: DimensionFilters,
  ) {
    const total = await this.repositories.impressions.countByRunFiltered(
      runId,
      filters,
    );

    const items = await this.repositories.impressions.listByRunPagedFiltered(
      runId,
      filters,
      offset,
      limit,
    );

    return { total, offset, limit, items };
  }

  async exportRunJson(runId: string) {
    return await this.getRun(runId);
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
