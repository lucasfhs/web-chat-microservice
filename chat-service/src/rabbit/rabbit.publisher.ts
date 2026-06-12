import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel } from 'amqplib';

@Injectable()
export class RabbitPublisher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.connection = await amqp.connect(
      this.config.getOrThrow<string>('RABBITMQ_URL'),
    );
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(
      this.config.getOrThrow<string>('RABBITMQ_EXCHANGE'),
      'topic',
      { durable: true },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  publish(routingKey: string, event: Record<string, unknown>): void {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not ready');
    }
    this.channel.publish(
      this.config.getOrThrow<string>('RABBITMQ_EXCHANGE'),
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: 'application/json' },
    );
  }
}
