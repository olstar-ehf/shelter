import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { AppService } from '../app.service';
import type { Locale } from '../i18n';
import { JSONScalar } from './json.scalar';

/**
 * The windbreak GraphQL domain, island.is style: the same service methods
 * the REST controller exposes, surfaced as queries + a mutation so the
 * Next.js host (and, in the monorepo, island.is apps) can consume the API
 * over GraphQL instead of ad-hoc JSON endpoints.
 */

@ObjectType()
export class WindbreakIdentity {
  @Field()
  fullName!: string;

  @Field()
  kennitala!: string;
}

@ObjectType()
export class WindbreakBasemapInfo {
  @Field()
  tileUrl!: string;

  @Field()
  attribution!: string;

  @Field(() => Number, { nullable: true })
  maxZoom?: number;
}

@ObjectType()
export class WindbreakApplicationContextPayload {
  @Field(() => WindbreakIdentity)
  identity!: WindbreakIdentity;

  @Field(() => [Number])
  landeignarnumer!: number[];

  @Field()
  lookupSummary!: string;

  /** GeoJSON FeatureCollection of the farmer's parcels. */
  @Field(() => JSONScalar)
  parcels!: unknown;

  /** GeoJSON FeatureCollection of existing windbreaks. */
  @Field(() => JSONScalar)
  windbreaks!: unknown;

  @Field(() => WindbreakBasemapInfo)
  basemap!: WindbreakBasemapInfo;
}

@ObjectType()
export class WindbreakSubmittedApplication {  @Field()
  ticketId!: string;

  @Field(() => String, { nullable: true })
  ticketUrl!: string | null;

  @Field(() => String, { nullable: true })
  applicationId!: string | null;

  @Field()
  submittedAt!: string;
}

@ObjectType()
export class WindbreakSubmitResult {
  @Field()
  applicationId!: string;

  @Field()
  ticketId!: string;

  @Field(() => String, { nullable: true })
  ticketUrl!: string | null;
}

@Resolver()
export class WindbreakDomainResolver {
  constructor(private readonly appService: AppService) {}

  /** The apply-page context (identity + parcels + windbreaks + basemap). */
  @Query(() => WindbreakApplicationContextPayload)
  windbreakApplicationContext(
    @Args('locale') locale: string,
  ): Promise<WindbreakApplicationContextPayload> {
    return this.appService.getApplyContext(locale as Locale);
  }

  /** The confirmation-page readback of a submitted (Zendesk) application. */
  @Query(() => WindbreakSubmittedApplication)
  windbreakSubmittedApplication(
    @Args('ticketId') ticketId: string,
    @Args('locale') locale: string,
  ): Promise<WindbreakSubmittedApplication> {
    return this.appService.getSubmittedContext(ticketId, locale as Locale);
  }

  /** Validate the drawn lines and submit them (Zendesk ticket + GeoJSON). */
  @Mutation(() => WindbreakSubmitResult)
  submitWindbreakApplication(
    @Args('answers', { type: () => JSONScalar }) answers: unknown,
    @Args('locale') locale: string,
  ): Promise<WindbreakSubmitResult> {
    return this.appService.submitApplication(answers, locale as Locale);
  }
}
