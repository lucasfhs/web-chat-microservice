import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ChatParticipant } from './chat-participant.model';
import { ChatAdmin } from './chat-admin.model';
import { Message } from './message.model';

@Table({ tableName: 'chats', timestamps: true, underscored: true })
export class Chat extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare name: string | null;

  @AllowNull(false)
  @Column(DataType.ENUM('private', 'group'))
  declare type: 'private' | 'group';

  @HasMany(() => ChatParticipant)
  declare participants?: ChatParticipant[];

  @HasMany(() => Message)
  declare messages?: Message[];

  @HasOne(() => ChatAdmin)
  declare admin?: ChatAdmin;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
