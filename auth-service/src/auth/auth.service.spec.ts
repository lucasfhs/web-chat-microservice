import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/models/user.model';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  const revokeToken = jest.fn();
  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(12),
  } as unknown as jest.Mocked<ConfigService>;
  const redisService = {
    revokeToken,
  } as unknown as jest.Mocked<RedisService>;

  const service = new AuthService(
    usersService,
    jwtService,
    configService,
    redisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a JWT for valid credentials', async () => {
    const user = {
      id: '52baae11-a767-492f-92e8-23b97784b011',
      email: 'user@example.com',
      passwordHash: 'hash',
    } as User;
    usersService.findByEmail.mockResolvedValue(user);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
    });
  });

  it('revokes a token until its expiration', async () => {
    revokeToken.mockResolvedValue(undefined);

    await service.logout('token', {
      sub: '52baae11-a767-492f-92e8-23b97784b011',
      email: 'user@example.com',
      exp: 2000000000,
    });

    expect(revokeToken).toHaveBeenCalledWith('token', 2000000000);
  });
});
