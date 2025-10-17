import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { PreviewScenarioDto } from './dto/preview-scenario.dto';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { JwtCookieAuthGuard } from '../auth/auth.guard';

@Controller('scenarios')
@UseGuards(JwtCookieAuthGuard)
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser | null) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.list(user.account_id);
  }

  @Get(':id')
  async get(
    @Param('id') scenarioId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.get(user.account_id, scenarioId);
  }

  @Post()
  async create(
    @Body() payload: CreateScenarioDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.create(user.account_id, user.user_id, payload);
  }

  @Put(':id')
  async update(
    @Param('id') scenarioId: string,
    @Body() payload: CreateScenarioDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.update(user.account_id, scenarioId, payload);
  }

  @Delete(':id')
  async remove(
    @Param('id') scenarioId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.remove(user.account_id, scenarioId);
  }

  @Post('preview')
  async preview(
    @Body() payload: PreviewScenarioDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    return this.scenariosService.preview(user.account_id, payload);
  }
}
