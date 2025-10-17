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

@Controller('line_items')
@UseGuards(JwtCookieAuthGuard)
export class LineItemsController {
  constructor(private readonly repositories: Repositories) {}

  @Get('by_io/:ioId')
  async listByInsertionOrder(
    @Param('ioId') insertionOrderId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    
    return {
      line_items: await this.repositories.lineItemsScoped.listByInsertionOrder(
        user.account_id,
        insertionOrderId,
      ),
    };
  }

  @Get(':id')
  async get(
    @Param('id') lineItemId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    
    return (
      (await this.repositories.lineItemsScoped.get(
        user.account_id,
        lineItemId,
      )) ?? { error: 'not_found' }
    );
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: RequestUser | null) {
    if (!user) throw new BadRequestException('unauthorized');
    
    const id = crypto.randomUUID();
    
    await this.repositories.lineItemsScoped.create({
      id,
      io_id: body.io_id,
      name: body.name,
      start_dt: new Date(body.start_dt),
      end_dt: new Date(body.end_dt),
      budget: Number(body.budget),
      cpm_bid: Number(body.cpm_bid ?? 15),
      pacing_strategy: body.pacing_strategy ?? 'even',
      targeting_json: body.targeting_json ?? {},
      caps_json: body.caps_json ?? {},
      floors_json: body.floors_json ?? {},
      status: body.status ?? 'active',
      created_at: new Date() as any,
      account_id: user.account_id,
    } as any);
    
    return { id };
  }

  @Put(':id')
  async update(
    @Param('id') lineItemId: string,
    @Body() body: any,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    
    await this.repositories.lineItemsScoped.update(
      user.account_id,
      lineItemId,
      body,
    );
    
    return { id: lineItemId };
  }

  @Delete(':id')
  async remove(
    @Param('id') lineItemId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    
    await this.repositories.lineItemsScoped.remove(user.account_id, lineItemId);
    
    return { id: lineItemId, deleted: true };
  }
}
