import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(
    ({ value }: TransformFnParams): unknown =>
      typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  name!: string;

  @Transform(
    ({ value }: TransformFnParams): unknown =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
