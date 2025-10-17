import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InsertionOrdersController } from './orders.controller';
import { LineItemsController } from './line-items.controller';
import { CreativesController } from './creatives.controller';
import { PolicyController } from './policy.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    InsertionOrdersController,
    LineItemsController,
    CreativesController,
    PolicyController,
  ],
})
export class DemandModule {}
