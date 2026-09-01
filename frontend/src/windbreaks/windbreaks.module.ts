import { Module } from '@nestjs/common';
import {
  MockWindbreakRegistryService,
  PostgresWindbreakRegistryService,
  WindbreakRegistryService,
} from './windbreak-registry.service';

/**
 * Existing windbreaks from the skógrækt PostGIS database. The mock is the
 * default; set WINDBREAK_REGISTRY_MOCK=false and configure the database
 * (WINDBREAK_DATABASE_URL or the PG* variables) to use the real registry.
 */
@Module({
  providers: [
    {
      provide: WindbreakRegistryService,
      useFactory: (): WindbreakRegistryService => {
        return process.env.WINDBREAK_REGISTRY_MOCK === 'false'
          ? new PostgresWindbreakRegistryService()
          : new MockWindbreakRegistryService();
      },
    },
  ],
  exports: [WindbreakRegistryService],
})
export class WindbreaksModule {}
