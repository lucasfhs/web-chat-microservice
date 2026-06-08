import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
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

  create(data: UserCreationAttributes): Promise<User> {
    return this.userModel.create(data);
  }
}
