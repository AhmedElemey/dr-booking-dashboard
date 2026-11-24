import { DateTime } from 'luxon';

import { AppointmentStatus } from '../../core/api/models';

export interface AppointmentActions {
  reschedule: boolean;
  cancel: boolean;
  complete: boolean;
  noShow: boolean;
  /** Q5: target status for correcting a mistaken terminal status, or null when not allowed. */
  correct: 'Completed' | 'NoShow' | null;
}

export const NO_ACTIONS: AppointmentActions = {
  reschedule: false,
  cancel: false,
  complete: false,
  noShow: false,
  correct: null,
};

/**
 * Which status actions the clinic can take on an appointment (spec section 3 transition table).
 * Only `Confirmed` appointments can change; `Cancelled` is terminal. `Completed` and `NoShow`
 * can be corrected into each other within 24 hours (Q5) — the server keys the window off the
 * close-out time; the UI approximates it as 24 hours after the visit end and the server stays
 * authoritative (`409 INVALID_TRANSITION` outside the window).
 */
export function availableActions(
  status: AppointmentStatus,
  startsAt: string,
  endsAt: string,
  now: DateTime,
): AppointmentActions {
  if (status === 'Completed' || status === 'NoShow') {
    const withinWindow = now <= DateTime.fromISO(endsAt).plus({ hours: 24 });
    return {
      ...NO_ACTIONS,
      correct: withinWindow ? (status === 'Completed' ? 'NoShow' : 'Completed') : null,
    };
  }
  if (status !== 'Confirmed') return NO_ACTIONS;
  const started = now >= DateTime.fromISO(startsAt);
  return {
    reschedule: true,
    cancel: !started,
    complete: started,
    noShow: started,
    correct: null,
  };
}
