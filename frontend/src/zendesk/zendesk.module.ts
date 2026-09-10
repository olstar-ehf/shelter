import { Module } from '@nestjs/common';
import {
  MockZendeskService,
  ZendeskApiService,
  ZendeskService,
} from './zendesk.service';

/**
 * Provides the Zendesk Support API integration - the real client by
 * default: submitting a windbreak application creates a Zendesk ticket with
 * the drawn lines attached as GeoJSON (the grant authority's database is
 * read-only). ZENDESK_MOCK=true selects the in-memory mock.
 */
@Module({
  providers: [
    {
      provide: ZendeskService,
      useFactory: (): ZendeskService => {
        return process.env.ZENDESK_MOCK === 'true'
          ? new MockZendeskService()
          : new ZendeskApiService();
      },
    },
  ],
  exports: [ZendeskService],
})
export class ZendeskModule {}
