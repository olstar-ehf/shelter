// Node resolution fallback for `@island.is/map/server` when the runtime or
// tooling does not honour the package.json "exports" map (e.g. TypeScript
// with moduleResolution "node" resolves the sibling server.d.ts).
module.exports = require('./dist/server.js');
