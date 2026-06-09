import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RabbitPublisher } from '../rabbit/rabbit.publisher';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatParticipant } from './models/chat-participant.model';
import { Chat } from './models/chat.model';
import { Message } from './models/message.model';
import { MessageRead } from './models/message-read.model';
import { ChatAdmin } from './models/chat-admin.model';

export interface ChatResult {
  id: string;
  name: string | null;
  type: 'private' | 'group';
  adminId: string;
  participants: Array<{
    userId: string;
    role: 'admin' | 'member';
    createdAt: Date;
  }>;
  messages?: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageResult {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  readBy: string[];
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat) private readonly chats: typeof Chat,
    @InjectModel(ChatParticipant)
    private readonly participants: typeof ChatParticipant,
    @InjectModel(ChatAdmin) private readonly admins: typeof ChatAdmin,
    @InjectModel(Message) private readonly messages: typeof Message,
    @InjectModel(MessageRead) private readonly reads: typeof MessageRead,
    private readonly sequelize: Sequelize,
    private readonly rabbit: RabbitPublisher,
  ) {}

  async create(userId: string, dto: CreateChatDto): Promise<ChatResult> {
    const participantIds = [...new Set([userId, ...dto.participantIds])];
    if (dto.type === 'private' && participantIds.length !== 2) {
      throw new BadRequestException(
        'Private chats require exactly two participants',
      );
    }
    if (dto.type === 'group' && !dto.name?.trim()) {
      throw new BadRequestException('Group name is required');
    }

    const chat = await this.sequelize.transaction(
      async (transaction: Transaction) => {
      const chat = await this.chats.create(
        { type: dto.type, name: dto.name?.trim() || null },
        { transaction },
      );
      await this.participants.bulkCreate(
        participantIds.map((participantId) => ({
          chatId: chat.id,
          userId: participantId,
        })),
        { transaction },
      );
      await this.admins.create(
        { chatId: chat.id, userId },
        { transaction },
      );
        return this.getById(userId, chat.id, transaction);
      },
    );
    const eventParticipantIds = chat.participants.map(
      (participant) => participant.userId,
    );
    this.rabbit.publish('chat.created', {
      event: 'chat.created',
      chat,
      participantIds: eventParticipantIds,
    });
    return chat;
  }

  async list(userId: string): Promise<ChatResult[]> {
    const memberships = await this.participants.findAll({
      where: { userId },
      attributes: ['chatId'],
    });
    const ids = memberships.map((membership) => membership.chatId);
    if (!ids.length) {
      return [];
    }
    const chats = await this.chats.findAll({
      where: { id: { [Op.in]: ids } },
      include: [
        { model: ChatAdmin, attributes: ['userId'] },
        {
          model: ChatParticipant,
          attributes: ['userId', 'createdAt'],
        },
        {
          model: Message,
          include: [{ model: MessageRead, attributes: ['userId'] }],
          limit: 1,
          separate: true,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });
    return chats.map((chat) => this.toChatResult(chat));
  }

  async getMessages(
    userId: string,
    chatId: string,
    limit: number,
  ): Promise<MessageResult[]> {
    await this.assertParticipant(userId, chatId);
    const messages = await this.messages.findAll({
      where: { chatId },
      include: [{ model: MessageRead, attributes: ['userId'] }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(Math.max(limit || 50, 1), 100),
    });
    return messages.reverse().map((message) => this.toMessageResult(message));
  }

  async createMessage(
    userId: string,
    chatId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResult> {
    await this.assertParticipant(userId, chatId);
    const message = await this.messages.create({
      chatId,
      senderId: userId,
      content: dto.content.trim(),
    });
    await this.chats.update(
      { updatedAt: new Date() },
      { where: { id: chatId }, silent: true },
    );
    const participantRows = await this.participants.findAll({
      where: { chatId },
    });
    const result = this.toMessageResult(message);
    this.rabbit.publish('message.created', {
      event: 'message.created',
      message: result,
      participantIds: participantRows.map(
        (participant) => participant.userId,
      ),
    });
    return result;
  }

  async addParticipant(
    userId: string,
    chatId: string,
    dto: AddParticipantDto,
  ): Promise<void> {
    const chat = await this.getById(userId, chatId);
    if (chat.type !== 'group') {
      throw new BadRequestException(
        'Participants can only be added to groups',
      );
    }
    this.assertAdmin(userId, chat);
    const [, created] = await this.participants.findOrCreate({
      where: { chatId, userId: dto.userId },
      defaults: { chatId, userId: dto.userId },
    });
    if (!created) {
      return;
    }
    const updatedChat = await this.getById(userId, chatId);
    this.rabbit.publish('participant.added', {
      event: 'participant.added',
      chat: updatedChat,
      addedUserId: dto.userId,
      participantIds: updatedChat.participants.map(
        (participant) => participant.userId,
      ),
    });
  }

  async removeParticipant(
    userId: string,
    chatId: string,
    participantId: string,
  ): Promise<void> {
    const chat = await this.getById(userId, chatId);
    if (chat.type !== 'group') {
      throw new BadRequestException(
        'Participants can only be removed from groups',
      );
    }
    this.assertAdmin(userId, chat);
    if (participantId === chat.adminId) {
      throw new BadRequestException('The group admin cannot be removed');
    }
    const participant = await this.participants.findOne({
      where: { chatId, userId: participantId },
    });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    const remainingIds = chat.participants
      .map((item) => item.userId)
      .filter((id) => id !== participantId);
    await participant.destroy();
    this.rabbit.publish('participant.removed', {
      event: 'participant.removed',
      chatId,
      removedUserId: participantId,
      participantIds: [...remainingIds, participantId],
    });
  }

  async markRead(
    userId: string,
    chatId: string,
  ): Promise<{ messageIds: string[]; readBy: string; readAt: Date }> {
    await this.assertParticipant(userId, chatId);
    const unreadMessages = await this.messages.findAll({
      where: { chatId, senderId: { [Op.ne]: userId } },
      include: [
        {
          model: MessageRead,
          required: false,
          where: { userId },
        },
      ],
    });
    const messagesToMark = unreadMessages.filter(
      (message) => !message.reads?.length,
    );
    if (!messagesToMark.length) {
      return { messageIds: [], readBy: userId, readAt: new Date() };
    }
    const readAt = new Date();
    await this.reads.bulkCreate(
      messagesToMark.map((message) => ({
        messageId: message.id,
        userId,
        createdAt: readAt,
      })),
      { ignoreDuplicates: true },
    );
    const participantRows = await this.participants.findAll({
      where: { chatId },
    });
    const result = {
      messageIds: messagesToMark.map((message) => message.id),
      readBy: userId,
      readAt,
    };
    this.rabbit.publish('message.read', {
      event: 'message.read',
      chatId,
      ...result,
      participantIds: participantRows.map(
        (participant) => participant.userId,
      ),
    });
    return result;
  }

  private async getById(
    userId: string,
    chatId: string,
    transaction?: Transaction,
  ): Promise<ChatResult> {
    await this.assertParticipant(userId, chatId, transaction);
    const chat = await this.chats.findByPk(chatId, {
      include: [
        { model: ChatAdmin, attributes: ['userId'] },
        {
          model: ChatParticipant,
          attributes: ['userId', 'createdAt'],
        },
      ],
      transaction,
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return this.toChatResult(chat);
  }

  private async assertParticipant(
    userId: string,
    chatId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const participant = await this.participants.findOne({
      where: { userId, chatId },
      transaction,
    });
    if (!participant) {
      throw new ForbiddenException(
        'User is not a participant of this chat',
      );
    }
  }

  private assertAdmin(userId: string, chat: ChatResult): void {
    if (chat.adminId !== userId) {
      throw new ForbiddenException('Only the group admin can manage members');
    }
  }

  private toChatResult(chat: Chat): ChatResult {
    const participants = [...(chat.participants ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const adminId = chat.admin?.userId ?? participants[0]?.userId;
    if (!adminId) {
      throw new Error(`Chat ${chat.id} has no participants`);
    }
    return {
      id: chat.id,
      name: chat.name,
      type: chat.type,
      adminId,
      participants: participants.map((participant) => ({
        userId: participant.userId,
        role: participant.userId === adminId ? 'admin' : 'member',
        createdAt: participant.createdAt,
      })),
      messages: chat.messages?.map((message) =>
        this.toMessageResult(message),
      ),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }

  private toMessageResult(message: Message): MessageResult {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      readBy: message.reads?.map((read) => read.userId) ?? [],
    };
  }
}
