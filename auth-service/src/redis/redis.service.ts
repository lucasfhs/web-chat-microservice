import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }

  async revokeToken(token: string, expiresAt: number): Promise<void> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) {
      return;
    }

    await this.client.set(this.getBlacklistKey(token), 'revoked', 'EX', ttlSeconds);
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    return (await this.client.exists(this.getBlacklistKey(token))) === 1;
  }

  private getBlacklistKey(token: string): string {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return `auth:blacklist:${tokenHash}`;
  }
}
