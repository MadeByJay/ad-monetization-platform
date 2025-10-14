import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
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

  @Get(':id') get(@Param('id') id: string) {
    return this.scenariosService.get(id);
  }

  @Post()
  async create(@Body() payload: CreateScenarioDto) {
    return this.scenariosService.create(payload);
  }

  @Put(':id') update(
    @Param('id') id: string,
    @Body() payload: CreateScenarioDto,
  ) {
    return this.scenariosService.update(id, payload);
  }

  @Delete(':id') remove(@Param('id') id: string) {
    return this.scenariosService.remove(id);
  }

  @Post('preview')
  async preview(@Body() payload: PreviewScenarioDto) {
    return this.scenariosService.preview(payload);
  }
}
