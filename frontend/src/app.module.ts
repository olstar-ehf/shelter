import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FasteignirModule } from './fasteignir/fasteignir.module';
import { WindbreaksModule } from './windbreaks/windbreaks.module';
import { ZendeskModule } from './zendesk/zendesk.module';
import { WindbreakDomainResolver } from './graphql/windbreak-domain.resolver';

@Module({
  imports: [
    FasteignirModule,
    WindbreaksModule,
    ZendeskModule,
    // island.is-style GraphQL domain next to the REST routes: the Next.js
    // host consumes the API over GraphQL, the REST endpoints stay for the
    // no-framework demo host and curl access.
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
      playground: false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, WindbreakDomainResolver],
})
export class AppModule {}
