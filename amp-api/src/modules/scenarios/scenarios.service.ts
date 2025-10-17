import { BadRequestException, Injectable } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import type { SlotOpportunity, SlotType } from '../auction/auction.types';

interface CreateScenarioPayload {
  name: string;
  config_json: Record<string, unknown>;
}

interface PreviewScenarioPayload {
  scenario_id?: string;
  config_json?: Record<string, unknown>;
  sample_size?: number;
  seed?: number;
  brand_safety?: 'G' | 'PG' | 'M';
}

@Injectable()
export class ScenariosService {
  constructor(private readonly repositories: Repositories) {}

  async list(accountId: string) {
    const scenarios = await this.repositories.scenariosScoped.list(accountId);
    return { scenarios };
  }

  async get(accountId: string, scenarioId: string) {
    const scenario = await this.repositories.scenariosScoped.get(
      accountId,
      scenarioId,
    );

    if (!scenario) return { error: 'scenario_not_found' };

    return scenario;
  }

  async create(
    accountId: string,
    userId: string,
    payload: CreateScenarioPayload,
  ) {
    if (
      typeof payload?.name !== 'string' ||
      typeof payload?.config_json !== 'object'
    ) {
      throw new BadRequestException('invalid_payload');
    }

    const id = crypto.randomUUID();

    await this.repositories.scenariosScoped.create({
      id,
      name: payload.name,
      config_json: payload.config_json,
      account_id: accountId,
      created_by_user_id: userId,
      created_at: undefined as never,
    });
    return { id };
  }

  async update(
    accountId: string,
    scenarioId: string,
    payload: CreateScenarioPayload,
  ) {
    const found = await this.repositories.scenariosScoped.get(
      accountId,
      scenarioId,
    );

    if (!found) throw new BadRequestException('scenario_not_found');
    
    await this.repositories.scenariosScoped.update(accountId, scenarioId, {
      name: payload.name,
      config_json: payload.config_json,
    });
    return { id: scenarioId };
  }

  async remove(accountId: string, scenarioId: string) {
    const found = await this.repositories.scenariosScoped.get(
      accountId,
      scenarioId,
    );
    if (!found) throw new BadRequestException('scenario_not_found');

    await this.repositories.scenariosScoped.remove(accountId, scenarioId);

    return { id: scenarioId, deleted: true };
  }

  async preview(accountId: string, payload: PreviewScenarioPayload) {
    const sampleSize = Math.max(1, Number(payload.sample_size ?? 30));

    const seed = Number.isFinite(payload.seed)
      ? Number(payload.seed)
      : undefined;

    // 1 - Resolve scenario config (scoped)
    let resolvedConfig = payload.config_json;

    if (!resolvedConfig && payload.scenario_id) {
      const scenario = await this.repositories.scenariosScoped.get(
        accountId,
        payload.scenario_id,
      );

      if (!scenario) throw new BadRequestException('scenario_not_found');

      resolvedConfig =
        typeof scenario.config_json === 'string'
          ? JSON.parse(scenario.config_json as any)
          : (scenario.config_json as Record<string, unknown>);
    }
    if (!resolvedConfig)
      throw new BadRequestException('missing_config_or_scenario_id');

    // 2 - Extract placements and cohort
    const placements = Array.isArray(
      (resolvedConfig as any)?.content?.placements,
    )
      ? ((resolvedConfig as any).content.placements as Array<{
          slotType?: string;
        }>)
      : [{ slotType: 'display' }];

    const slotTypes: SlotType[] = placements
      .map((p) => (p.slotType ?? 'display') as SlotType)
      .filter(
        (s): s is SlotType =>
          s === 'preroll' || s === 'midroll' || s === 'display',
      );
    if (slotTypes.length === 0) slotTypes.push('display');

    const geoWeights = (resolvedConfig as any)?.cohort?.geoWeights ?? { US: 1 };

    const deviceWeights = (resolvedConfig as any)?.cohort?.deviceWeights ?? {
      desktop: 1,
      mobile: 1,
    };

    const contentTags: string[] = Array.isArray(
      (resolvedConfig as any)?.cohort?.contentTags,
    )
      ? (resolvedConfig as any).cohort.contentTags
      : ['general'];

    // brand safety override > config > default
    const brandSafety: 'G' | 'PG' | 'M' =
      payload.brand_safety ??
      ((resolvedConfig as any)?.content?.brandSafety as any) ??
      'G';

    // 3 - Random helpers
    const random = seededRandom(seed ?? Date.now());

    // 4 - Generate synthetic opportunities
    const sample: SlotOpportunity[] = Array.from({ length: sampleSize }).map(
      () => {
        const slotType = pickWeighted(slotTypes, undefined, random);

        const geo = pickWeighted(
          Object.keys(geoWeights),
          Object.values(geoWeights),
          random,
        );

        const device = pickWeighted(
          Object.keys(deviceWeights),
          Object.values(deviceWeights),
          random,
        ) as 'desktop' | 'mobile';

        const tags = pickSome(
          contentTags,
          1 +
            Math.floor(random() * Math.min(3, Math.max(1, contentTags.length))),
        );

        const ts = new Date();
        const userId = `${device}_${geo}`;

        return {
          slotType,
          user: { geo, device, userId },
          content: { tags, brandSafety },
          ts,
        };
      },
    );

    // 5 - Aggregate preview mix
    const mix = {
      slots: countsAndPercentages(sample.map((s) => s.slotType)),
      geo: countsAndPercentages(sample.map((s) => s.user.geo ?? 'NA')),
      device: countsAndPercentages(
        sample.map((s) => s.user.device ?? 'unknown'),
      ),
    };

    return {
      scenario_id: payload.scenario_id ?? null,
      sample_size: sampleSize,
      slot_types_declared: Array.from(new Set(slotTypes)),
      brand_safety: brandSafety,
      mix,
      sample,
    };
  }
}

// Helpers
function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

// Pick 1 value; if weights is undefined, pick uniform.
function pickWeighted<T>(
  items: T[],
  weights: number[] | undefined,
  rand: () => number,
): T {
  if (!items.length) throw new Error('pickWeighted: empty items');

  if (!weights || weights.length !== items.length) {
    const index = Math.floor(rand() * items.length);
    return items[index];
  }

  const total = weights.reduce(
    (a, b) => a + (Number.isFinite(b) ? Number(b) : 0),
    0,
  );

  if (total <= 0) {
    const index = Math.floor(rand() * items.length);
    return items[index];
  }

  const r = rand() * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += Number(weights[i]);
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}

function pickSome<T>(arr: T[], k: number): T[] {
  const out: T[] = [];
  const copy = [...arr];
  for (let i = 0; i < Math.min(k, copy.length); i++) {
    const index = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(index, 1)[0]);
  }
  return out;
}

function countsAndPercentages(values: string[]) {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  const total = values.length || 1;
  const pct: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts))
    pct[k] = Number(((v / total) * 100).toFixed(1));
  return { counts, pct };
}
