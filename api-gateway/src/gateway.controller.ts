import {
  All,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GatewayResponse, GatewayService } from './gateway.service';

@Controller()
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  @Get('health')
  health(): Promise<Record<string, string>> {
    return this.gateway.health();
  }

  @All('auth/:path')
  async auth(
    @Param('path') path: string,
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    this.respond(
      response,
      await this.gateway.auth(path, request.method, body, authorization),
    );
  }

  @All('chats')
  async chatsRoot(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    this.respond(
      response,
      await this.gateway.chat('chats', request.method, body, authorization, query),
    );
  }

  @All('chats/*path')
  async chats(
    @Param('path') path: string | string[],
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    const suffix = Array.isArray(path) ? path.join('/') : path;
    this.respond(
      response,
      await this.gateway.chat(`chats/${suffix}`, request.method, body, authorization, query),
    );
  }

  private respond(response: Response, upstream: GatewayResponse): void {
    if (upstream.status === 204) {
      response.status(204).send();
      return;
    }
    response.status(upstream.status).json(upstream.data);
  }
}
