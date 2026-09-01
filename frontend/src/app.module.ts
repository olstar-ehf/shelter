import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FasteignirModule } from './fasteignir/fasteignir.module';
import { WindbreaksModule } from './windbreaks/windbreaks.module';

@Module({
  imports: [FasteignirModule, WindbreaksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
