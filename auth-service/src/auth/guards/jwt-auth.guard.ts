import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (await this.redisService.isTokenRevoked(token)) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.email !== payload.email) {
        throw new UnauthorizedException('Invalid token subject');
      }

      request.authToken = token;
      request.jwtPayload = payload;
      request.user = user;
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(authorization?: string): string {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }
    return token;
  }
}
