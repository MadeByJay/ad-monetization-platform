import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SimulateController } from './simulate.controller';
import { SimulateService } from './simulate.service';
import { AuctionModule } from '../auction/auction.module';
import { PacingModule } from '../pacing/pacing.module';
import { FrequencyModule } from '../frequency/frequency.module';

@Module({
  imports: [
    DatabaseModule,
    MetricsModule,
    AuctionModule,
    PacingModule,
    FrequencyModule,
  ],
  controllers: [SimulateController],
  providers: [SimulateService],
  exports: [SimulateService],
})
export class SimulateModule {}
