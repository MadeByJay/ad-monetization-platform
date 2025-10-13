import { Module, Controller, Get, Header } from '@nestjs/common';
import { register, collectDefaultMetrics } from 'prom-client';
import { MetricsService } from './metrics.service';

collectDefaultMetrics();

@Controller('metrics')
class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
