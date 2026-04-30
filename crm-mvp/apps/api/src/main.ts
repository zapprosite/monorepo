import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_URL || 'http://localhost:3000' });
  await app.listen(process.env.API_PORT || 4000);
  console.log(`API running on http://localhost:${process.env.API_PORT || 4000}`);
}
bootstrap();
