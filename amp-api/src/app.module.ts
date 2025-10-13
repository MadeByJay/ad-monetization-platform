import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './modules/database/database.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SimulateModule } from './modules/simulate/simulate.module';
import { ScenariosModule } from './modules/scenarios/scenarios.module';
import { ListingsModule } from './modules/listings/listings.module';
import { AuctionModule } from './modules/auction/auction.module';
import { RedisModule } from './modules/redis/redis.module';
import { PacingModule } from './modules/pacing/pacing.module';
import { FrequencyModule } from './modules/frequency/frequency.module';

@Module({
  imports: [
    // ignore .env when running in Docker
    // set IGNORE_ENV_FILE=true
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true },
              }
            : undefined,
        genReqId: (req: any) =>
          (req.headers['x-correlation-id'] as string) || crypto.randomUUID(),
        customProps: (req: any) => ({ correlationId: req.id }),
        redact: { paths: ['req.headers.authorization'], remove: true },
      },
    }),
    DatabaseModule,
    MetricsModule,
    SimulateModule,
    ScenariosModule,
    ListingsModule,
    AuctionModule,
    RedisModule,
    PacingModule,
    FrequencyModule,
    AppModule,
  ],
})
export class AppModule {}
