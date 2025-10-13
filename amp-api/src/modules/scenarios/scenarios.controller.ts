import { Body, Controller, Get, Post } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { PreviewScenarioDto } from './dto/preview-scenario.dto';

@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Get()
  async list() {
    return this.scenariosService.list();
  }

  @Post()
  async create(@Body() payload: CreateScenarioDto) {
    return this.scenariosService.create(payload);
  }

  @Post('preview')
  async preview(@Body() payload: PreviewScenarioDto) {
    return this.scenariosService.preview(payload);
  }
}
