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
const windbreakDir = path.join(scriptsDir, '..');
const mapDir = path.resolve(scriptsDir, '..', '..', '..', '..', 'map');
const scopeDir = path.join(windbreakDir, 'node_modules', '@island.is');
const linkPath = path.join(scopeDir, 'map');

try {
  fs.mkdirSync(scopeDir, { recursive: true });
  fs.rmSync(linkPath, { recursive: true, force: true });
  fs.symlinkSync(mapDir, linkPath, 'dir');
  console.log(`fix-lib-link: @island.is/map -> ${mapDir}`);
} catch (err) {
  console.warn(`fix-lib-link: could not fix the link: ${err.message}`);
}
