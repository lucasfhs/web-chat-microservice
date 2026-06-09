import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class DatabaseSchemaService implements OnApplicationBootstrap {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sequelize.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT NULL',
    );
  }
}
