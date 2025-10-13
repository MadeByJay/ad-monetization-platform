import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '../../types/database';
import { REDIS } from '../redis/redis.module';

@Controller()
export class HealthController {
  constructor(
    @Inject('DB') private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: any,
  ) {}

  @Get('healthz')
  healthz() {
    return { ok: true };
  }

  @Get('readyz')
  async readyz() {
    const checks: Record<string, boolean> = { db: false, redis: false };

    try {
      await sql`select 1`.execute(this.db);
      checks.db = true;
    } catch {
      checks.db = false;
    }

    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    }

    const ok = Object.values(checks).every(Boolean);
    return { ok, checks };
  }
}
