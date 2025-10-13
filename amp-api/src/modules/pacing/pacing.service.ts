import { Inject, Injectable } from '@nestjs/common';
import { REDIS } from '../redis/redis.module';

type PacingStrategy = 'even' | 'asap';

interface PacingCheckInput {
  campaignId: string;
  dailyBudget: number;
  pacingStrategy: PacingStrategy;
  now: Date;
}

export interface PacingDecision {
  eligible: boolean;
  reason?: 'budget';
  pacingMultiplier: number; // 0..1 to down-weight overspending; 1 if on plan
  actualSpend: number;
  plannedSpend: number;
}

@Injectable()
export class PacingService {
  constructor(@Inject(REDIS) private readonly redis: any) {}

  private key(campaignId: string, yyyymmdd: string) {
    return `amp:spend:${campaignId}:${yyyymmdd}`;
  }

  private todayKey(now: Date) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  async addSpend(
    campaignId: string,
    amount: number,
    when = new Date(),
  ): Promise<void> {
    const key = this.key(campaignId, this.todayKey(when));
    await this.redis.incrByFloat(key, amount);
    // expire in 3 days to avoid unbounded keys
    await this.redis.expire(key, 60 * 60 * 24 * 3);
  }

  async getSpendToday(campaignId: string, when = new Date()): Promise<number> {
    const key = this.key(campaignId, this.todayKey(when));
    const value = await this.redis.get(key);
    return value ? Number(value) : 0;
  }

  /**
   * even: plannedSpend = dailyBudget * (elapsed_day_ratio)
   * asap: no pacing throttle; only stop at total budget
   * If actualSpend >= dailyBudget => ineligible (budget).
   * If overspending vs plan (even), return a multiplier < 1 (e.g., 0.5).
   */
  async check(input: PacingCheckInput): Promise<PacingDecision> {
    const { campaignId, dailyBudget, pacingStrategy, now } = input;
    const actualSpend = await this.getSpendToday(campaignId, now);

    if (actualSpend >= dailyBudget) {
      return {
        eligible: false,
        reason: 'budget',
        pacingMultiplier: 0,
        actualSpend,
        plannedSpend: dailyBudget,
      };
    }

    if (pacingStrategy === 'asap') {
      return {
        eligible: true,
        pacingMultiplier: 1,
        actualSpend,
        plannedSpend: dailyBudget,
      };
    }

    // even pacing
    const dayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const elapsed = now.getTime() - dayStart.getTime();
    const ratio = Math.max(0, Math.min(1, elapsed / (24 * 60 * 60 * 1000)));
    const plannedSpend = dailyBudget * ratio;

    // Allow 10% tolerance over plan before throttling
    if (actualSpend > plannedSpend * 1.1) {
      // down-weight aggressively when behind plan (0.5)
      return {
        eligible: true,
        pacingMultiplier: 0.5,
        actualSpend,
        plannedSpend,
      };
    }

    return { eligible: true, pacingMultiplier: 1, actualSpend, plannedSpend };
  }
}
