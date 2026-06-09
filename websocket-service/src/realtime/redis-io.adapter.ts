import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    const publisher = new Redis(url);
    const subscriber = publisher.duplicate();
    await Promise.all([publisher.ping(), subscriber.ping()]);
    this.adapterConstructor = createAdapter(publisher, subscriber);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (!this.adapterConstructor) {
      throw new Error('Redis Socket.IO adapter is not initialized');
    }
    server.adapter(this.adapterConstructor);
    return server;
  }
}
