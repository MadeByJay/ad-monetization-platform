import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
  exports: [ScenariosService],
})
export class ScenariosModule {}
