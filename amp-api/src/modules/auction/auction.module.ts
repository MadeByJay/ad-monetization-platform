import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PacingModule } from '../pacing/pacing.module';
import { AuctionService } from './auction.service';
import { TargetingService } from './targeting.service';
import { MetricsModule } from '../metrics/metrics.module';
import { FrequencyModule } from '../frequency/frequency.module';

@Module({
  imports: [DatabaseModule, PacingModule, MetricsModule, FrequencyModule],
  providers: [AuctionService, TargetingService],
  exports: [AuctionService],
})
export class AuctionModule {}
