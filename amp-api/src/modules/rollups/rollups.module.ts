import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { RollupsService } from './rollups.service';
import { RollupsController } from './rollups.controller';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  providers: [RollupsService],
  controllers: [RollupsController],
  exports: [RollupsService],
})
export class RollupsModule {}
