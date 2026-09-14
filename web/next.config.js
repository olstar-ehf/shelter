/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // Sandbox filesystems can refuse renames inside .next (EXDEV); allow an
  // alternate build dir (e.g. NEXT_DIST_DIR=/tmp/web-next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
