import { Controller, Get, Query } from '@nestjs/common';
import { Repositories } from '../../repositories/repositories';

@Controller()
export class DimensionsController {
  constructor(private readonly repos: Repositories) {}

  @Get('brands')
  async brands() {
    const brands = await this.repos.brands.list();
    return { brands };
  }

  @Get('products')
  async products(@Query('brand_id') brandId?: string) {
    const products = await this.repos.products.list(brandId || undefined);
    return { products };
  }

  @Get('studios')
  async studios() {
    const studios = await this.repos.studios.list();
    return { studios };
  }

  @Get('movies')
  async movies(@Query('studio_id') studioId?: string) {
    const movies = await this.repos.movies.list(studioId || undefined);
    return { movies };
  }
}
