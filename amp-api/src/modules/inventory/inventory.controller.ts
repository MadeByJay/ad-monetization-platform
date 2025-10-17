import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';

@Controller()
export class InventoryController {
  constructor(private readonly repos: Repositories) {}

  @Get('inventory/tree')
  async tree() {
    return this.repos.inventory.tree();
  }

  @Get('pods')
  async pods(
    @Query('content_type') contentType?: string,
    @Query('content_id') contentId?: string,
  ) {
    if (!contentType || !contentId)
      throw new BadRequestException('content_type and content_id are required');

    if (!['episode', 'movie', 'event_occurrence'].includes(contentType))
      throw new BadRequestException('invalid content_type');

    const pods = await this.repos.pods.listByContent(
      contentType as any,
      contentId,
    );

    const slotsByPod = new Map<string, any[]>();

    for (const p of pods)
      slotsByPod.set(p.id, await this.repos.podSlots.listByPod(p.id));

    return {
      pods: pods.map((p) => ({ ...p, slots: slotsByPod.get(p.id) ?? [] })),
    };
  }
}
