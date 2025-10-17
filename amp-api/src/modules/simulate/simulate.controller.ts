import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SimulateService } from './simulate.service';
import { StartRunDto } from './dto/start-run.dto';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

@Controller()
export class SimulateController {
  constructor(private readonly simulateService: SimulateService) {}

  @Post('simulate/run')
  async startRun(
    @Body() payload: StartRunDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    return this.simulateService.startRunScoped(payload, user ?? null);
  }

  @Get('simulate/run/:id')
  async getRun(@Param('id') runId: string) {
    return this.simulateService.getRun(runId);
  }

  @Get('runs')
  async listRuns(@Query('limit') limit?: string) {
    const n = Math.max(1, Math.min(500, Number(limit ?? 50)));
    return this.simulateService.listRuns(n);
  }

  @Get('simulate/run/:id/summary')
  async getRunSummary(@Param('id') runId: string) {
    return this.simulateService.getRunSummary(runId);
  }

  @Get('simulate/run/:id/impressions')
  async getRunImpressions(
    @Param('id') id: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.simulateService.getRunImpressions(
      id,
      Number(offset ?? 0),
      Math.max(1, Math.min(500, Number(limit ?? 50))),
    );
  }

  @Get('simulate/run/:id/export.json')
  @Header('Content-Type', 'application/json')
  async exportJson(@Param('id') runId: string) {
    return this.simulateService.exportRunJson(runId);
  }

  @Get('simulate/run/:id/export.csv')
  async exportCsv(@Param('id') runId: string, @Res() res: Response) {
    const { filename, content } =
      await this.simulateService.exportRunCsv(runId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
