import { Inject, Injectable } from '@nestjs/common';
import { REDIS } from '../redis/redis.module';

export interface FrequencyCheckInput {
  campaignId: string;
  userId: string;
  capPerUserPerDay: number;
  now: Date;
}

export interface FrequencyDecision {
  eligible: boolean;
  reason?: 'frequency';
  countToday: number;
  cap: number;
}

@Injectable()
export class FrequencyService {
  constructor(@Inject(REDIS) private readonly redis: any) {}

  private dateKey(now: Date) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private key(campaignId: string, userId: string, now: Date) {
    return `amp:freq:${campaignId}:${userId}:${this.dateKey(now)}`;
  }

  async increment(
    campaignId: string,
    userId: string,
    when = new Date(),
  ): Promise<number> {
    const key = this.key(campaignId, userId, when);
    const next = await this.redis.incr(key);
    // expire after 3 days to keep keys bounded
    await this.redis.expire(key, 60 * 60 * 24 * 3);
    return Number(next);
  }

  async getCountToday(
    campaignId: string,
    userId: string,
    when = new Date(),
  ): Promise<number> {
    const key = this.key(campaignId, userId, when);
    const v = await this.redis.get(key);
    return v ? Number(v) : 0;
  }

  async check(input: FrequencyCheckInput): Promise<FrequencyDecision> {
    const { campaignId, userId, capPerUserPerDay, now } = input;
    if (!capPerUserPerDay || capPerUserPerDay <= 0) {
      return { eligible: true, countToday: 0, cap: 0 };
    }
    const count = await this.getCountToday(campaignId, userId, now);
    if (count >= capPerUserPerDay) {
      return {
        eligible: false,
        reason: 'frequency',
        countToday: count,
        cap: capPerUserPerDay,
      };
    }
    return { eligible: true, countToday: count, cap: capPerUserPerDay };
  }
}
