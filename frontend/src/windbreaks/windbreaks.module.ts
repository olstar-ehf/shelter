import { Module } from '@nestjs/common';
import {
  MockWindbreakRegistryService,
  PostgresWindbreakRegistryService,
  WindbreakRegistryService,
} from './windbreak-registry.service';
import {
  GeoJsonWindbreakApplicationsStore,
  PostgresWindbreakApplicationsStore,
  WindbreakApplicationsStore,
} from './windbreak-applications.store';

/**
 * The windbreak data module (island.is style): real clients by default,
 * mocks only when explicitly requested.
 *
 *  - WindbreakRegistryService - existing windbreaks from the skógrækt
 *    PostGIS registry (skograekt.skjolbelti). Real unless
 *    WINDBREAK_REGISTRY_MOCK=true.
 *  - WindbreakApplicationsStore - submitted applications in PostGIS
 *    (windbreak_applications, db migrations own the schema). Real unless
 *    WINDBREAK_APPLICATIONS_MOCK=true (GeoJSON file fallback).
 *
 * Database connection: WINDBREAK_DATABASE_URL or the PG* variables.
 */
@Module({
  providers: [
    {
      provide: WindbreakRegistryService,
      useFactory: (): WindbreakRegistryService => {
        return process.env.WINDBREAK_REGISTRY_MOCK === 'true'
          ? new MockWindbreakRegistryService()
          : new PostgresWindbreakRegistryService();
      },
    },
    {
      provide: WindbreakApplicationsStore,
      useFactory: (): WindbreakApplicationsStore => {
        return process.env.WINDBREAK_APPLICATIONS_MOCK === 'true'
          ? new GeoJsonWindbreakApplicationsStore()
          : new PostgresWindbreakApplicationsStore();
      },
    },
  ],
  exports: [WindbreakRegistryService, WindbreakApplicationsStore],
})
export class WindbreaksModule {}
