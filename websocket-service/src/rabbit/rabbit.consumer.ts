import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { RealtimeGateway } from '../realtime/realtime.gateway';

interface RealtimeEvent {
  event:
    | 'message.created'
    | 'message.read'
    | 'chat.created'
    | 'participant.added'
    | 'participant.removed';
  participantIds: string[];
  [key: string]: unknown;
}

@Injectable()
export class RabbitConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.connection = await amqp.connect(
      this.config.getOrThrow<string>('RABBITMQ_URL'),
    );
    this.channel = await this.connection.createChannel();
    const exchange = this.config.getOrThrow<string>('RABBITMQ_EXCHANGE');
    const queue = this.config.getOrThrow<string>('RABBITMQ_QUEUE');
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, '#');
    await this.channel.prefetch(20);
    await this.channel.consume(queue, (message) => this.consume(message), {
      noAck: false,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private consume(message: ConsumeMessage | null): void {
    if (!message || !this.channel) {
      return;
    }
    try {
      const event = JSON.parse(
        message.content.toString(),
      ) as RealtimeEvent;
      this.gateway.emitEvent(event);
      this.channel.ack(message);
    } catch {
      this.channel.nack(message, false, false);
    }
  }
}
