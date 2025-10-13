import { Global, Module } from '@nestjs/common';
import { createClient } from 'redis';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: async () => {
        const client = createClient({
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        });
        client.on('error', (error) => console.error('Redis error', error));
        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
