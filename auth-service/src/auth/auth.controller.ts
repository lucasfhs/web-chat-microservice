import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService, LoginResult, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.authService.logout(request.authToken, request.jwtPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate')
  validate(@Req() request: AuthenticatedRequest): PublicUser {
    return this.authService.toPublicUser(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put('avatar')
  updateAvatar(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateAvatarDto,
  ): Promise<PublicUser> {
    return this.authService.updateAvatar(request.user, dto.avatarUrl);
  }

  @Get('health')
  health(): Record<string, string> {
    return { status: 'ok', service: 'auth-service' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  async users(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
  ): Promise<PublicUser[]> {
    return this.authService.listUsers(request.user.id, search);
  }
}
