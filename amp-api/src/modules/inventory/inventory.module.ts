import { Module } from '@nestjs/common'
import { InventoryController } from './inventory.controller'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
})
export class InventoryModule {}
