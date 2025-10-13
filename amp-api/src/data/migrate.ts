import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  await app.close();
  // Tables are ensured by DatabaseModule on bootstrap
  // eslint-disable-next-line no-console
  console.log('Migration ensured tables exist.');
}

void main();
