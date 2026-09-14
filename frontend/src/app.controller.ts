import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppService } from './app.service';
import { createTranslator, resolveLocale, type Locale } from './i18n';

/** Body of POST /apply: the template's answers (see windbreakAnswersSchema). */
export interface SubmitApplicationBody {
  answers?: unknown;
}

/** Minimal per-request i18n state. */
interface I18n {
  locale: Locale;
}

/**
 * The data every React page gets from the server, embedded as JSON in the
 * HTML shell (client/main.tsx -> PageRoot). Everything visible is rendered
 * by React; the server only localizes error messages.
 */
export type PageData =
  | {
      page: 'index';
      locale: string;
      identity: { fullName: string; kennitala: string };
    }
  | {
      page: 'apply';
      locale: string;
      identity: { fullName: string; kennitala: string };
      error?: string;
      lookupSummary?: string;
      parcels?: unknown[];
      windbreaks?: unknown[];
    }
  | {
      page: 'submitted';
      locale: string;
      error?: string;
      ticket?: {
        ticketId: string;
        ticketUrl: string | null;
        applicationId: string | null;
        submittedAt: string;
      };
    };

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
  return { locale };
}

/** Serialize the page data into an HTML-script-safe JSON string. */
function embedJson(data: PageData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The HTML shell every page shares - no template engine, just JSON. */
function renderShell(res: Response, data: PageData): void {
  const html = `<!DOCTYPE html>
<html lang="${data.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Windbreak Grant Scheme</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/app.css" />
</head>
<body>
  <div id="app-root"></div>
  <script id="page-data" type="application/json">${embedJson(data)}</script>
  <script src="/app.js"></script>
</body>
</html>`;
  res.type('html').send(html);
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Landing page: the (assumed) portal session plus the start button. */
  @Get()
  index(@Req() req: Request, @Res() res: Response) {
    const i18n = resolveI18n(req, res);
    renderShell(res, {
      page: 'index',
      locale: i18n.locale,
      identity: {
        fullName: this.appService.demoFullName,
        kennitala: this.appService.demoKennitala,
      },
    });
  }

  /**
   * The application form. Only the name and kennitala of the user are
   * assumed; their properties are looked up through (mocked)
   * Fasteignir-Xroad and the land/windbreaks through the OGC API backend.
   * The page only asks where the windbreak should be.
   */
  @Get('apply')
  async apply(@Req() req: Request, @Res() res: Response) {
    const i18n = resolveI18n(req, res);
    const identity = {
      fullName: this.appService.demoFullName,
      kennitala: this.appService.demoKennitala,
    };
    try {
      const context = await this.appService.getApplyContext(i18n.locale);
      renderShell(res, {
        page: 'apply',
        locale: i18n.locale,
        identity,
        lookupSummary: context.lookupSummary,
        parcels: context.parcels,
        windbreaks: context.windbreaks,
      });
    } catch (err) {
      renderShell(res, {
        page: 'apply',
        locale: i18n.locale,
        identity,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Receive the application answers (the drawn windbreak lines), re-check
   * them against the template's data schema and the land server side, and
   * log the application as a Zendesk ticket with a GeoJSON attachment of
   * the lines (the grant authority's database is read-only). Returns the
   * WB reference and the Zendesk ticket id.
   */
  @Post('apply')
  async submit(
    @Body() body: SubmitApplicationBody,
    @Req() req: Request,
  ): Promise<{ applicationId: string; ticketId: string; ticketUrl: string | null }> {
    const locale = resolveLocale(
      req.query,
      parseCookies(req),
      req.headers['accept-language'],
    );
    const t = createTranslator(locale);
    if (!body || typeof body.answers !== 'object' || body.answers === null) {
      throw new BadRequestException(t('errorNoLines'));
    }
    return this.appService.submitApplication(body.answers, locale);
  }

  /** Confirmation page: shows the Zendesk ticket the application became. */
  @Get('submitted/:ticketId')
  async submitted(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const i18n = resolveI18n(req, res);
    try {
      const context = await this.appService.getSubmittedContext(
        ticketId,
        i18n.locale,
      );
      renderShell(res, {
        page: 'submitted',
        locale: i18n.locale,
        ticket: {
          ticketId: context.ticketId,
          ticketUrl: context.ticketUrl,
          applicationId: context.applicationId,
          submittedAt: context.submittedAt,
        },
      });
    } catch (err) {
      renderShell(res, {
        page: 'submitted',
        locale: i18n.locale,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
