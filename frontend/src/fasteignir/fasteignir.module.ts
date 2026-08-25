import { Module } from '@nestjs/common';
import {
  FasteignirService,
  MockFasteignirService,
  XroadFasteignirService,
} from './fasteignir.service';

/**
 * Provides the Fasteignir-Xroad lookup. The mock is the default because the
 * real service requires an island.is Bearer token; set FASTEIGNIR_MOCK=false
 * and FASTEIGNIR_TOKEN to use the real X-Road endpoint.
 */
@Module({
  providers: [
    {
      provide: FasteignirService,
      useFactory: (): FasteignirService => {
        return process.env.FASTEIGNIR_MOCK === 'false'
          ? new XroadFasteignirService()
          : new MockFasteignirService();
      },
    },
  ],
  exports: [FasteignirService],
})
export class FasteignirModule {}
