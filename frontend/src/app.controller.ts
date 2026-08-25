import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Render,
} from '@nestjs/common';
import type { Feature, LineString } from 'geojson';
import { AppService } from './app.service';

/** Body of POST /apply: the GeoJSON lines drawn by the farmer. */
export interface SubmitApplicationBody {
  lines?: Feature<LineString, Record<string, unknown>>[];
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Landing page: the (assumed) portal session plus the start button. */
  @Get()
  @Render('index')
  index() {
    return {
      demoFullName: this.appService.demoFullName,
      demoKennitala: this.appService.demoKennitala,
    };
  }

  /**
   * The application form. Only the name and kennitala of the user are
   * assumed; their properties are looked up through (mocked)
   * Fasteignir-Xroad and the land/windbreaks through the OGC API backend.
   * The page only asks where the windbreak should be.
   */
  @Get('apply')
  @Render('apply')
  async apply() {
    try {
      return await this.appService.getApplyContext();
    } catch (err) {
      return {
        error: errorMessage(err),
        identity: {
          fullName: this.appService.demoFullName,
          kennitala: this.appService.demoKennitala,
        },
      };
    }
  }

  /**
   * Receive the drawn windbreak lines, re-validate them server side and
   * store them in the OGC API backend. Returns the new application id.
   */
  @Post('apply')
  async submit(
    @Body() body: SubmitApplicationBody,
  ): Promise<{ applicationId: string }> {
    if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
      throw new BadRequestException('No windbreak lines were received.');
    }
    return this.appService.submitApplication(body.lines);
  }

  /** Confirmation page for a submitted application. */
  @Get('submitted/:applicationId')
  @Render('submitted')
  async submitted(@Param('applicationId') applicationId: string) {
    try {
      return await this.appService.getSubmittedContext(applicationId);
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }
}
