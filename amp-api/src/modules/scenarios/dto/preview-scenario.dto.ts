import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class PreviewScenarioDto {
  @IsOptional()
  @IsUUID('4')
  scenario_id?: string;

  @IsOptional()
  @IsObject()
  config_json?: Record<string, unknown>;

  // Number of synthetic opportunities to sample (default 30)
  @IsOptional()
  @IsInt()
  @Min(1)
  sample_size?: number;

  // Optional seed for deterministic sampling
  @IsOptional()
  @IsInt()
  seed?: number;

  @IsOptional()
  @IsIn(['G', 'PG', 'M'])
  brand_safety?: 'G' | 'PG' | 'M';
}
