import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface GatewayResponse {
  status: number;
  data: unknown;
}

@Injectable()
export class GatewayService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async auth(path: string, method: string, body: unknown, authorization?: string): Promise<GatewayResponse> {
    return this.forward(
      `${this.config.getOrThrow<string>('AUTH_SERVICE_URL')}/auth/${path}`,
      { method, data: body, headers: authorization ? { authorization } : undefined },
    );
  }

  async chat(
    path: string,
    method: string,
    body: unknown,
    authorization?: string,
    query?: Record<string, unknown>,
  ): Promise<GatewayResponse> {
    const user = await this.validateToken(authorization);
    return this.forward(
      `${this.config.getOrThrow<string>('CHAT_SERVICE_URL')}/${path}`,
      {
        method,
        data: body,
        params: query,
        headers: {
          authorization,
          'x-user-id': user.id,
          'x-user-email': user.email,
        },
      },
    );
  }

  async health(): Promise<Record<string, string>> {
    return { status: 'ok', service: 'api-gateway' };
  }

  private async validateToken(authorization?: string): Promise<PublicUser> {
    if (!authorization) {
      throw new UnauthorizedException('Bearer token is required');
    }
    const response = await this.forward(
      `${this.config.getOrThrow<string>('AUTH_SERVICE_URL')}/auth/validate`,
      { method: 'GET', headers: { authorization } },
    );
    if (response.status !== 200) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return response.data as PublicUser;
  }

  private async forward(url: string, request: AxiosRequestConfig): Promise<GatewayResponse> {
    try {
      const response = await firstValueFrom(
        this.http.request({ url, validateStatus: () => true, ...request }),
      );
      return { status: response.status, data: response.data };
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError ? error.message : 'Upstream service unavailable';
      throw new BadGatewayException(message);
    }
  }
}
