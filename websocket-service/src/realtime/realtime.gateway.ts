import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
  email: string;
}

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

@WebSocketGateway({
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.user = payload;
      await client.join(`user:${payload.sub}`);
      this.server.emit('user.online', { userId: payload.sub });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const payload = client.data.user as JwtPayload | undefined;
    if (payload) {
      this.server.emit('user.offline', { userId: payload.sub });
    }
  }

  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  emitEvent(event: RealtimeEvent): void {
    const payload = this.getPayload(event);
    for (const participantId of event.participantIds) {
      this.server.to(`user:${participantId}`).emit(event.event, payload);
    }
  }

  private getPayload(event: RealtimeEvent): unknown {
    if (event.event === 'message.created') {
      return event.message;
    }
    if (event.event === 'chat.created' || event.event === 'participant.added') {
      return event.chat;
    }
    const { event: _event, participantIds: _participantIds, ...payload } =
      event;
    return payload;
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth.token as string | undefined;
    const authorization = client.handshake.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const token = authToken || bearerToken;
    if (!token) {
      throw new Error('Authentication token is required');
    }
    return token;
  }
}
