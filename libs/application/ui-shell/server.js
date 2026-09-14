// Node resolution fallback for the /server subpath when the runtime or
// tooling does not honour the package.json "exports" map (e.g. TypeScript
// with moduleResolution "node" resolves the sibling server.d.ts).
module.exports = require('./dist/server.js');
