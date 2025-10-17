import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExportsController } from './exports.controller';
import { SimulateModule } from '../simulate/simulate.module';

@Module({
  imports: [DatabaseModule, SimulateModule],
  controllers: [ExportsController],
})
export class ExportsModule {}
