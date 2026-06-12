import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatParticipant } from './models/chat-participant.model';
import { Chat } from './models/chat.model';
import { Message } from './models/message.model';
import { MessageRead } from './models/message-read.model';
import { ChatAdmin } from './models/chat-admin.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Chat,
      ChatAdmin,
      ChatParticipant,
      Message,
      MessageRead,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
