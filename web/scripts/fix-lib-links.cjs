#!/usr/bin/env node
/**
 * Fixes the @island.is file: links inside this package's node_modules (npm
 * can create scoped file: symlinks one level too deep). Runs before
 * dev/build. The libs' own node_modules must already be installed
 * (npm ci in libs/map and libs/application/templates/windbreak first).
 */
const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const scopeDir = path.join(webDir, 'node_modules', '@island.is');
const links = {
  map: path.resolve(webDir, '..', 'libs', 'map'),
  'windbreak-application': path.resolve(
    webDir, '..', 'libs', 'application', 'templates', 'windbreak',
  ),
  'application-ui-shell': path.resolve(
    webDir, '..', 'libs', 'application', 'ui-shell',
  ),
};

try {
  fs.mkdirSync(scopeDir, { recursive: true });
  for (const [name, target] of Object.entries(links)) {
    const linkPath = path.join(scopeDir, name);
    fs.rmSync(linkPath, { recursive: true, force: true });
    fs.symlinkSync(target, linkPath, 'dir');
  }
  console.log('fix-lib-links: @island.is/* -> libs');
} catch (err) {
  console.warn(`fix-lib-links: could not fix the links: ${err.message}`);
}
