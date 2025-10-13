import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartRunDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @IsUUID('4', { message: 'scenario_id must be a valid UUID v4' })
  scenario_id?: string;
}
