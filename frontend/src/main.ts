import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static assets (Leaflet bundle, styles) and Handlebars views live at the
  // project root, next to the compiled server in dist/.
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
