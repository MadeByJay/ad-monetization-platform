import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';
import { JwtCookieAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

@Controller('line_items/:id/policy')
@UseGuards(JwtCookieAuthGuard)
export class PolicyController {
  constructor(private readonly repositories: Repositories) {}

  @Get()
  async getAll(
    @Param('id') lineItemId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    const [exclusions, separation] = await Promise.all([
      this.repositories.policyScoped.listExclusions(
        user.account_id,
        lineItemId,
      ),
      this.repositories.policyScoped.listCompetitiveSeparation(
        user.account_id,
        lineItemId,
      ),
    ]);

    return {
      category_exclusions: exclusions,
      competitive_separation: separation,
    };
  }

  @Post('category_exclusions')
  async setExclusions(
    @Param('id') lineItemId: string,
    @Body() body: { categories: string[] },
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.policyScoped.replaceExclusions(
      user.account_id,
      lineItemId,
      body.categories ?? [],
    );

    return { id: lineItemId, categories: body.categories ?? [] };
  }

  @Post('competitive_separation')
  async setSeparation(
    @Param('id') lineItemId: string,
    @Body()
    body: { rules: Array<{ category: string; min_separation_min: number }> },
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.policyScoped.upsertCompetitiveSeparation(
      user.account_id,
      lineItemId,
      body.rules ?? [],
    );

    return { id: lineItemId, rules: body.rules ?? [] };
  }
}
