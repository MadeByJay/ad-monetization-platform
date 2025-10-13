import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
  exports: [ScenariosService],
})
export class ScenariosModule {}
