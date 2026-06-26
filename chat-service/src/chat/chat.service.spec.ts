import { BadRequestException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { RabbitPublisher } from '../rabbit/rabbit.publisher';
import { ChatService } from './chat.service';
import { ChatAdmin } from './models/chat-admin.model';
import { ChatParticipant } from './models/chat-participant.model';
import { Chat } from './models/chat.model';
import { MessageRead } from './models/message-read.model';
import { Message } from './models/message.model';

describe('ChatService', () => {
  const chats = {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as typeof Chat;
  const participants = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    bulkCreate: jest.fn(),
  } as unknown as typeof ChatParticipant;
  const admins = {
    create: jest.fn(),
  } as unknown as typeof ChatAdmin;
  const messages = {
    create: jest.fn(),
  } as unknown as typeof Message;
  const reads = {} as typeof MessageRead;
  const sequelize = {
    transaction: jest.fn(),
  } as unknown as Sequelize;
  const rabbit = {
    publish: jest.fn(),
  } as unknown as jest.Mocked<RabbitPublisher>;

  const service = new ChatService(
    chats,
    participants,
    admins,
    messages,
    reads,
    sequelize,
    rabbit,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a private chat without exactly two participants', async () => {
    await expect(
      service.create('user-1', {
        type: 'private',
        participantIds: ['user-2', 'user-3'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a name when creating a group', async () => {
    await expect(
      service.create('user-1', {
        type: 'group',
        name: '   ',
        participantIds: ['user-2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists a message and publishes it for every participant', async () => {
    const createdAt = new Date('2026-06-21T18:00:00.000Z');
    jest.mocked(participants.findOne).mockResolvedValue({
      chatId: 'chat-1',
      userId: 'user-1',
    } as ChatParticipant);
    jest.mocked(messages.create).mockResolvedValue({
      id: 'message-1',
      chatId: 'chat-1',
      senderId: 'user-1',
      content: 'Mensagem de teste',
      createdAt,
    } as Message);
    jest.mocked(chats.update).mockResolvedValue([1]);
    jest.mocked(participants.findAll).mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ] as ChatParticipant[]);

    const result = await service.createMessage('user-1', 'chat-1', {
      content: '  Mensagem de teste  ',
    });

    expect(messages.create).toHaveBeenCalledWith({
      chatId: 'chat-1',
      senderId: 'user-1',
      content: 'Mensagem de teste',
    });
    expect(rabbit.publish).toHaveBeenCalledWith('message.created', {
      event: 'message.created',
      message: result,
      participantIds: ['user-1', 'user-2'],
    });
  });
});
