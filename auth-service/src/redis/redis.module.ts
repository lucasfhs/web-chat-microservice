import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis =>
        new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password:
            configService.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
