/** @type {import('next').NextConfig} */
const path = require('path');

// island.is-style security headers, enforced by default (mirrors the
// production island.is CSP; no opt-out flag). The only environment-derived
// pieces are facts, not loosening: 'unsafe-eval' for Next dev-mode HMR and
// the basemap tile origin (CSP_IMG_ORIGIN) so <img> tiles load from our
// own proxy origin in development; in production both are 'self'.
const tileOrigin = process.env.CSP_IMG_ORIGIN || '';
const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const csp = [
  "default-src 'self'",
  `script-src 'self'${devEval}`,
  "style-src 'self' 'unsafe-inline'", // Leaflet/React inline styles
  `img-src 'self' data: blob:${tileOrigin ? ` ${tileOrigin}` : ''}`,
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'interest-cohort=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubdomains; preload',
  },
];
if (process.env.CSP_REPORT_URI) {
  securityHeaders.push({
    key: 'Content-Security-Policy-Report-Only',
    value: `${csp}; report-uri ${process.env.CSP_REPORT_URI}`,
  });
}

const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // Sandbox filesystems can refuse renames inside .next (EXDEV); allow an
  // alternate build dir (e.g. NEXT_DIST_DIR=/tmp/web-next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  webpack: (config) => {
    // The libs have their own node_modules: force a single React +
    // react-intl instance (the app's), or IntlProvider/useIntl contexts
    // would not match during SSR and hydration.
    for (const name of ['react', 'react-dom', 'react-intl']) {
      config.resolve.alias[name] = path.resolve(__dirname, 'node_modules', name);
    }
    return config;
  },
};

module.exports = nextConfig;
