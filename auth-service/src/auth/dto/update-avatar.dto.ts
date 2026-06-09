import { IsDataURI, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsDataURI()
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,/)
  @MaxLength(100_000)
  avatarUrl!: string;
}
