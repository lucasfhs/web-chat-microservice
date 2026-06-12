import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { Optional } from 'sequelize';

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'avatarUrl' | 'createdAt' | 'updatedAt'
>;

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
})
export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(254))
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING(60))
  declare passwordHash: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare avatarUrl: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
