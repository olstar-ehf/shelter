/**
 * React-free entry for server-side consumers: the app chrome message
 * catalogs (used by the NestJS server to localize errors and the lookup
 * summary) without pulling React into the server bundle.
 */
export { messages, flattenMessages, en, is } from './messages';
export type { AppLocale } from './messages';
