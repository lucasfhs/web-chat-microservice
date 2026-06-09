import {
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Message } from './message.model';

@Table({
  tableName: 'message_reads',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class MessageRead extends Model {
  @PrimaryKey
  @ForeignKey(() => Message)
  @Column(DataType.UUID)
  declare messageId: string;

  @PrimaryKey
  @Column(DataType.UUID)
  declare userId: string;

  @CreatedAt
  declare createdAt: Date;
}
