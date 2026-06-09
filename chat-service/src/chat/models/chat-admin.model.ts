import {
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
  tableName: 'chat_admins',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class ChatAdmin extends Model {
  @PrimaryKey
  @ForeignKey(() => Chat)
  @Column(DataType.UUID)
  declare chatId: string;

  @Column(DataType.UUID)
  declare userId: string;

  @CreatedAt
  declare createdAt: Date;
}
