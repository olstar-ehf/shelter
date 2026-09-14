import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static assets (React bundle, styles) live next to the compiled server
  // in dist/. Pages are plain React clients mounted from the shell HTML
  // the controller returns (embedded JSON, no template engine).
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
