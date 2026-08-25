import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FasteignirModule } from './fasteignir/fasteignir.module';

@Module({
  imports: [FasteignirModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
