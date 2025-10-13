import { Injectable } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';

@Injectable()
export class ListingsService {
  constructor(private readonly repositories: Repositories) {}

  async listCampaigns() {
    const campaigns = await this.repositories.campaigns.list();
    return { campaigns };
  }

  async listCreatives() {
    const creatives = await this.repositories.creatives.list();
    return { creatives };
  }
}
