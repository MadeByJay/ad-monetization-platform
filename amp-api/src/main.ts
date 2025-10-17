import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { CorrelationIdInterceptor } from './shared/interceptors/correlation-id.interceptor';
import { seedWithApp } from './data/seed';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Swagger - I just like the word
  const config = new DocumentBuilder()
    .setTitle('Ad Monetization Platform API')
    .setDescription('Simulation, scenarios, and results API')
    .setVersion('0.1.0')
    .addServer('/api')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  if (
    (process.env.SEED_ON_START ?? 'true').toString().toLowerCase() === 'true'
  ) {
    try {
      logger.log('Seed started');
      await seedWithApp(app);
      logger.log('Seed completed');
    } catch (error) {
      logger.error(error, 'Seed failed');
    }
  }

  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port, '0.0.0.0');
  logger.log(`Nest API listening on ${port}`);
}
bootstrap();
