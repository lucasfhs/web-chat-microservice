import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Chat } from './chat.model';
import { MessageRead } from './message-read.model';

@Table({
  tableName: 'messages',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class Message extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Chat)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare chatId: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare senderId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @HasMany(() => MessageRead)
  declare reads?: MessageRead[];

  @CreatedAt
  declare createdAt: Date;
}
