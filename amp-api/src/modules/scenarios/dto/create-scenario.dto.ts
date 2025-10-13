import { IsObject, IsString } from 'class-validator';

export class CreateScenarioDto {
  @IsString()
  name!: string;

  @IsObject()
  config_json!: Record<string, unknown>;
}
