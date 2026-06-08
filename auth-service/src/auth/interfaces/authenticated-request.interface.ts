import { Request } from 'express';
import { User } from '../../users/models/user.model';
import { JwtPayload } from './jwt-payload.interface';

export interface AuthenticatedRequest extends Request {
  authToken: string;
  jwtPayload: JwtPayload;
  user: User;
}
