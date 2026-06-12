import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Chat } from './chat.model';

@Table({
  tableName: 'chat_participants',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class ChatParticipant extends Model {
  @PrimaryKey
  @ForeignKey(() => Chat)
  @Column(DataType.UUID)
  declare chatId: string;

  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @CreatedAt
  declare createdAt: Date;
}
