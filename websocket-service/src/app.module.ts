import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health.controller';
import { validateEnvironment } from './env.validation';
import { RabbitConsumer } from './rabbit/rabbit.consumer';
import { RealtimeGateway } from './realtime/realtime.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [RealtimeGateway, RabbitConsumer],
})
export class AppModule {}
