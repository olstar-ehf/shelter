#!/usr/bin/env node
/**
 * Fixes the template's own @island.is/map link (a `file:` dependency):
 * npm can create scoped file: symlinks one directory too deep
 * ("Cannot find module '@island.is/map'"). Runs automatically before
 * build/typecheck/test via package.json pre* hooks, so neither the
 * container nor local development depends on npm's link depth.
 *
 * target: libs/map (4 levels up from this script: libs/application/
 *         templates/windbreak/scripts -> libs)
 */
const fs = require('fs');
const path = require('path');

const scriptsDir = __dirname;
const pkgDir = path.join(scriptsDir, '..');
const scopeDir = path.join(pkgDir, 'node_modules', '@island.is');
// libs/application/ui-shell -> libs/application/templates/windbreak (../../templates/windbreak)
// libs/application/ui-shell -> libs/map (../../map)
const links = {
  map: path.resolve(pkgDir, '..', '..', 'map'),
  'windbreak-application': path.resolve(pkgDir, '..', 'templates', 'windbreak'),
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
