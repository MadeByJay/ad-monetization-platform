import { Controller, Get, Param } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import { RollupsService } from './rollups.service';

@Controller('rollups')
export class RollupsController {
  constructor(
    private readonly repositories: Repositories,
    private readonly rollupsService: RollupsService,
  ) {}

  @Get('run/:id')
  async getForRun(@Param('id') runId: string) {
    const row = await this.repositories.rollups.getRunRollup(runId);
    if (row) return row;
    await this.rollupsService.computeAndStoreForRun(runId);
    return await this.repositories.rollups.getRunRollup(runId);
  }
}
