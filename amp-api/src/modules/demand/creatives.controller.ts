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
import { Repositories } from '../../repositories/repositories';
import { JwtCookieAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

@Controller('creatives')
@UseGuards(JwtCookieAuthGuard)
export class CreativesController {
  constructor(private readonly repositories: Repositories) {}

  @Get('by_line_item/:lineItemId')
  async listByLineItem(
    @Param('lineItemId') lineItemId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    return {
      creatives: await this.repositories.liCreativesScoped.listByLineItem(
        user.account_id,
        lineItemId,
      ),
    };
  }

  @Post('by_line_item/:lineItemId')
  async createForLineItem(
    @Param('lineItemId') lineItemId: string,
    @Body() body: any,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    const id = crypto.randomUUID();

    await this.repositories.liCreativesScoped.createForLineItem({
      id,
      campaign_id: null,
      line_item_id: lineItemId,
      type: body.type,
      duration_sec: body.duration_sec ?? null,
      size: body.size ?? null,
      brand_safety: body.brand_safety ?? 'G',
      account_id: user.account_id,
    } as any);

    return { id };
  }

  @Put(':id')
  async update(
    @Param('id') creativeId: string,
    @Body() body: any,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.liCreativesScoped.update(
      user.account_id,
      creativeId,
      body,
    );

    return { id: creativeId };
  }

  @Delete(':id')
  async remove(
    @Param('id') creativeId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.liCreativesScoped.remove(
      user.account_id,
      creativeId,
    );

    return { id: creativeId, deleted: true };
  }
}
