"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.is = exports.en = exports.messages = void 0;
exports.flattenMessages = flattenMessages;
const en_1 = require("./en");
Object.defineProperty(exports, "en", { enumerable: true, get: function () { return en_1.en; } });
const is_1 = require("./is");
Object.defineProperty(exports, "is", { enumerable: true, get: function () { return is_1.is; } });
/** All locales in one object - feed the active one to IntlProvider. */
exports.messages = { is: is_1.is, en: en_1.en };
/**
 * Flatten the nested namespace object into the flat map IntlProvider
 * expects (island.is's libs/localization does the same when loading
 * namespaces).
 */
function flattenMessages(ns) {
    const result = {};
    const walk = (obj, prefix) => {
        for (const [key, value] of Object.entries(obj)) {
            const id = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null) {
                walk(value, id);
            }
            else {
                result[id] = value;
            }
        }
    };
    walk(ns, '');
    return result;
}
