import { plainToInstance, Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  AUTH_SERVICE_URL!: string;

  @IsString()
  @IsNotEmpty()
  CHAT_SERVICE_URL!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN = '*';
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(errors.toString());
  }
  return validated;
}
