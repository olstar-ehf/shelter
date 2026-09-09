import { Module } from '@nestjs/common';
import {
  FasteignirService,
  MockFasteignirService,
  XroadFasteignirService,
} from './fasteignir.service';

/**
 * Provides the Fasteignir-Xroad lookup - the real client by default, as in
 * the island.is monorepo: FASTEIGNIR_MOCK=true is the explicit escape hatch
 * for running the prototype without an island.is Bearer token. The real
 * client requires FASTEIGNIR_TOKEN and fails with a clear error when it is
 * missing.
 */
@Module({
  providers: [
    {
      provide: FasteignirService,
      useFactory: (): FasteignirService => {
        return process.env.FASTEIGNIR_MOCK === 'true'
          ? new MockFasteignirService()
          : new XroadFasteignirService();
      },
    },
  ],
  exports: [FasteignirService],
})
export class FasteignirModule {}
