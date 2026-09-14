/**
 * React entry of the shared application UI: the page shell (topbar/footer/
 * language switcher), the stepper and the three pages, plus the app chrome
 * message catalogs. Hosts (NestJS demo client, Next.js web app) import the
 * same components - only the bootstrap differs.
 */
export { Shell } from './components/Shell';
export type { ShellProps } from './components/Shell';
export { Stepper } from './components/Stepper';
export { IndexPage } from './components/IndexPage';
export type { IndexPageProps } from './components/IndexPage';
export { SubmittedPage } from './components/SubmittedPage';
export type { SubmittedPageProps } from './components/SubmittedPage';
export { ApplyPage } from './components/ApplyPage';
export type { ApplyPageProps } from './components/ApplyPage';
export { messages, flattenMessages, en, is } from './messages';
export type { AppLocale } from './messages';
