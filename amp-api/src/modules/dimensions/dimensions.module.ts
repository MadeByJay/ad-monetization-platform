import { Module } from '@nestjs/common';
import { DimensionsController } from './dimensions.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DimensionsController],
})
export class DimensionsModule {}
