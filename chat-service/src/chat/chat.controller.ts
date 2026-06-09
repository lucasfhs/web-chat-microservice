import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  ChatResult,
  ChatService,
  MessageResult,
} from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('health')
  health(): Record<string, string> {
    return { status: 'ok', service: 'chat-service' };
  }

  @Post('chats')
  create(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateChatDto,
  ): Promise<ChatResult> {
    return this.chatService.create(this.requireUser(userId), dto);
  }

  @Get('chats')
  list(@Headers('x-user-id') userId: string): Promise<ChatResult[]> {
    return this.chatService.list(this.requireUser(userId));
  }

  @Get('chats/:chatId/messages')
  messages(
    @Headers('x-user-id') userId: string,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ): Promise<MessageResult[]> {
    return this.chatService.getMessages(
      this.requireUser(userId),
      chatId,
      limit,
    );
  }

  @Post('chats/:chatId/messages')
  createMessage(
    @Headers('x-user-id') userId: string,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageResult> {
    return this.chatService.createMessage(
      this.requireUser(userId),
      chatId,
      dto,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('chats/:chatId/participants')
  addParticipant(
    @Headers('x-user-id') userId: string,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: AddParticipantDto,
  ): Promise<void> {
    return this.chatService.addParticipant(
      this.requireUser(userId),
      chatId,
      dto,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('chats/:chatId/participants/:participantId')
  removeParticipant(
    @Headers('x-user-id') userId: string,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<void> {
    return this.chatService.removeParticipant(
      this.requireUser(userId),
      chatId,
      participantId,
    );
  }

  @Post('chats/:chatId/read')
  markRead(
    @Headers('x-user-id') userId: string,
    @Param('chatId', ParseUUIDPipe) chatId: string,
  ): Promise<{ messageIds: string[]; readBy: string; readAt: Date }> {
    return this.chatService.markRead(this.requireUser(userId), chatId);
  }

  private requireUser(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException(
        'Gateway user identity is required',
      );
    }
    return userId;
  }
}
