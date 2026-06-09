import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User, UserCreationAttributes } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  findOthers(userId: string, search?: string): Promise<User[]> {
    return this.userModel.findAll({
      where: {
        id: { [Op.ne]: userId },
        ...(search
          ? {
              [Op.or]: [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
              ],
            }
          : {}),
      },
      order: [['name', 'ASC']],
      limit: 50,
    });
  }

  create(data: UserCreationAttributes): Promise<User> {
    return this.userModel.create(data);
  }

  async updateAvatar(user: User, avatarUrl: string): Promise<User> {
    user.avatarUrl = avatarUrl;
    return user.save();
  }
}
