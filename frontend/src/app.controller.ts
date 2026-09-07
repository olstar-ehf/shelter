import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Render,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Feature, LineString } from 'geojson';
import { AppService } from './app.service';
import {
  createTranslator,
  messages,
  resolveLocale,
  type Locale,
} from './i18n';

/** Body of POST /apply: the GeoJSON lines drawn by the farmer. */
export interface SubmitApplicationBody {
  lines?: Feature<LineString, Record<string, unknown>>[];
}

/** A small per-request i18n helper shared by all routes. */
interface I18n {
  locale: Locale;
  /** Raw catalog for the views (static keys via {{t.key}}). */
  t: Record<string, string>;
  isActive: boolean;
  enActive: boolean;
}

function parseCookies(req: Request): Record<string, string | undefined> {
  const header = req.headers.cookie;
  const result: Record<string, string | undefined> = {};
  if (!header) {
    return result;
  }
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      result[part.slice(0, eq).trim()] = decodeURIComponent(
        part.slice(eq + 1).trim(),
      );
    }
  }
  return result;
}

function resolveI18n(req: Request, res: Response): I18n {
  const locale = resolveLocale(
    req.query,
    parseCookies(req),
    req.headers['accept-language'],
  );
  // Persist an explicit language choice.
  if (typeof req.query.lang === 'string') {
    res.cookie('lang', locale, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
    });
  }
  return {
    locale,
    t: messages[locale],
    isActive: locale === 'is',
    enActive: locale === 'en',
  };
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Landing page: the (assumed) portal session plus the start button. */
  @Get()
  @Render('index')
  index(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const i18n = resolveI18n(req, res);
    const t = createTranslator(i18n.locale);
    return {
      ...i18n,
      indexIdentity: t('indexIdentity', {
        name: this.appService.demoFullName,
        kennitala: this.appService.demoKennitala,
      }),
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
  async apply(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const i18n = resolveI18n(req, res);
    try {
      return {
        ...i18n,
        ...(await this.appService.getApplyContext(i18n.locale)),
        localeJson: JSON.stringify({ locale: i18n.locale }),
      };
    } catch (err) {
      return {
        ...i18n,
        error:
          err instanceof Error ? err.message : String(err),
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
    @Req() req: Request,
  ): Promise<{ applicationId: string }> {
    const locale = resolveLocale(
      req.query,
      parseCookies(req),
      req.headers['accept-language'],
    );
    const t = createTranslator(locale);
    if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
      throw new BadRequestException(t('errorNoLines'));
    }
    return this.appService.submitApplication(body.lines, locale);
  }

  /** Confirmation page for a submitted application. */
  @Get('submitted/:applicationId')
  @Render('submitted')
  async submitted(
    @Param('applicationId') applicationId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const i18n = resolveI18n(req, res);
    try {
      return {
        ...i18n,
        ...(await this.appService.getSubmittedContext(
          applicationId,
          i18n.locale,
        )),
      };
    } catch (err) {
      return {
        ...i18n,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
