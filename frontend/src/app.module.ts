import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FasteignirModule } from './fasteignir/fasteignir.module';
import { WindbreaksModule } from './windbreaks/windbreaks.module';
import { ZendeskModule } from './zendesk/zendesk.module';

@Module({
  imports: [FasteignirModule, WindbreaksModule, ZendeskModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
