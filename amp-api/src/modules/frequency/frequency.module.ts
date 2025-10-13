import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { FrequencyService } from './frequency.service';

@Module({
  imports: [RedisModule],
  providers: [FrequencyService],
  exports: [FrequencyService],
})
export class FrequencyModule {}
