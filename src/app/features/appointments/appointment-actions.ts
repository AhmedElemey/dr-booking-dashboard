import { DateTime } from 'luxon';

import { AppointmentStatus } from '../../core/api/models';

export interface AppointmentActions {
  reschedule: boolean;
  cancel: boolean;
  complete: boolean;
  noShow: boolean;
}

export const NO_ACTIONS: AppointmentActions = {
  reschedule: false,
  cancel: false,
  complete: false,
  noShow: false,
};

/**
 * Which status actions the clinic can take on an appointment (spec section 3 transition table).
 * `Cancelled`, `Completed` and `NoShow` are terminal. For `Confirmed`, cancel is allowed until
 * the slot starts; complete and no-show only once it has started. With liveQueue a checked-in
 * visit can still complete or no-show, and a visit with the doctor can complete.
 * The server stays authoritative and answers `409 INVALID_TRANSITION` for anything else.
 */
export function availableActions(
  status: AppointmentStatus,
  startsAt: string,
  now: DateTime,
): AppointmentActions {
  if (status === 'CheckedIn') return { ...NO_ACTIONS, complete: true, noShow: true };
  if (status === 'InProgress') return { ...NO_ACTIONS, complete: true };
  if (status !== 'Confirmed') return NO_ACTIONS;
  const started = now >= DateTime.fromISO(startsAt);
  return {
    reschedule: true,
    cancel: !started,
    complete: started,
    noShow: started,
  };
}
