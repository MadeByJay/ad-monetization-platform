import { Controller, Get } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller()
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('campaigns')
  async campaigns() {
    return this.listingsService.listCampaigns();
  }

  @Get('creatives')
  async creatives() {
    return this.listingsService.listCreatives();
  }
}
