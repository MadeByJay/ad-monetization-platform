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

@Controller('insertion_orders')
@UseGuards(JwtCookieAuthGuard)
export class InsertionOrdersController {
  constructor(private readonly repositories: Repositories) {}

  @Get()
  async list(@CurrentUser() user: RequestUser | null) {
    if (!user) throw new BadRequestException('unauthorized');

    const orders = await this.repositories.insertionOrdersScoped.list(
      user.account_id,
    );

    return { orders };
  }

  @Get(':id')
  async get(
    @Param('id') insertionOrderId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    const row = await this.repositories.insertionOrdersScoped.get(
      user.account_id,
      insertionOrderId,
    );

    return row ?? { error: 'not_found' };
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: RequestUser | null) {
    if (!user) throw new BadRequestException('unauthorized');

    const id = crypto.randomUUID();

    await this.repositories.insertionOrdersScoped.create({
      id,
      name: body.name,
      advertiser: body.advertiser,
      start_date: new Date(body.start_date),
      end_date: new Date(body.end_date),
      budget_total: Number(body.budget_total),
      status: body.status ?? 'active',
      created_at: new Date() as any,
      account_id: user.account_id,
    } as any);

    return { id };
  }

  @Put(':id')
  async update(
    @Param('id') insertionOrderId: string,
    @Body() body: any,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.insertionOrdersScoped.update(
      user.account_id,
      insertionOrderId,
      body,
    );

    return { id: insertionOrderId };
  }

  @Delete(':id')
  async remove(
    @Param('id') insertionOrderId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');

    await this.repositories.insertionOrdersScoped.remove(
      user.account_id,
      insertionOrderId,
    );

    return { id: insertionOrderId, deleted: true };
  }
}
