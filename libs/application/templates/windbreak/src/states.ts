import type {
  WindbreakApplication,
  WindbreakApplicationEvent,
  WindbreakApplicationState,
} from './types';

/**
 * State machine of the windbreak application, island.is style.
 *
 *   draft ──SUBMIT──▶ submitted
 *
 * The SUBMIT event is only valid while the answers validate (the dataSchema
 * guard) - the server re-checks that before storing the application.
 */
export const windbreakStates: WindbreakApplicationState[] = [
  'draft',
  'submitted',
];

/** Whether the SUBMIT event is allowed in the given state. */
export function canTransition(
  from: WindbreakApplicationState,
  event: WindbreakApplicationEvent,
): boolean {
  if (from === 'draft' && event.type === 'SUBMIT') {
    return true;
  }
  return false;
}

/** Produce the next state, or null when the event is not allowed. */
export function transition(
  application: WindbreakApplication,
  event: WindbreakApplicationEvent,
): WindbreakApplication | null {
  if (!canTransition(application.state, event)) {
    return null;
  }
  return {
    ...application,
    state: 'submitted',
    modifiedAt: new Date().toISOString(),
  };
}
