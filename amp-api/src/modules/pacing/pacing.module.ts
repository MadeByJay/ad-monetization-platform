import { Module } from '@nestjs/common'
import { RedisModule } from '../redis/redis.module'
import { PacingService } from './pacing.service'

@Module({
  imports: [RedisModule],
  providers: [PacingService],
  exports: [PacingService]
})
export class PacingModule {}
