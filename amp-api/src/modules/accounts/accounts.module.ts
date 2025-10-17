import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccountsController } from './accounts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AccountsController],
})
export class AccountsModule {}
