"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenMessages = exports.messages = exports.is = exports.en = exports.MIN_LENGTH_M = exports.validateWindbreakLines = exports.validateLine = exports.totalLengthM = exports.measureLineM = exports.linesConflict = exports.lineContainedIn = exports.landUnion = void 0;
/**
 * React-free entry point for server-side consumers (e.g. the NestJS API).
 *
 * Node require()s the whole module graph of whatever it imports, so the
 * server must not pull in react-leaflet (ESM-only). This entry re-exports
 * only the pure parts of the lib: geometry, validation, types and messages.
 *
 *   import { validateWindbreakLines, flattenMessages } from '@island.is/map/server';
 */
var geometry_1 = require("./geometry");
Object.defineProperty(exports, "landUnion", { enumerable: true, get: function () { return geometry_1.landUnion; } });
Object.defineProperty(exports, "lineContainedIn", { enumerable: true, get: function () { return geometry_1.lineContainedIn; } });
Object.defineProperty(exports, "linesConflict", { enumerable: true, get: function () { return geometry_1.linesConflict; } });
Object.defineProperty(exports, "measureLineM", { enumerable: true, get: function () { return geometry_1.measureLineM; } });
Object.defineProperty(exports, "totalLengthM", { enumerable: true, get: function () { return geometry_1.totalLengthM; } });
Object.defineProperty(exports, "validateLine", { enumerable: true, get: function () { return geometry_1.validateLine; } });
Object.defineProperty(exports, "validateWindbreakLines", { enumerable: true, get: function () { return geometry_1.validateWindbreakLines; } });
Object.defineProperty(exports, "MIN_LENGTH_M", { enumerable: true, get: function () { return geometry_1.MIN_LENGTH_M; } });
var messages_1 = require("./messages");
Object.defineProperty(exports, "en", { enumerable: true, get: function () { return messages_1.en; } });
Object.defineProperty(exports, "is", { enumerable: true, get: function () { return messages_1.is; } });
Object.defineProperty(exports, "messages", { enumerable: true, get: function () { return messages_1.messages; } });
Object.defineProperty(exports, "flattenMessages", { enumerable: true, get: function () { return messages_1.flattenMessages; } });
