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
 * Only `Confirmed` appointments can change; `Cancelled`, `Completed` and `NoShow` are terminal.
 * Cancel is allowed until the slot starts; complete and no-show only once it has started.
 * The server stays authoritative and answers `409 INVALID_TRANSITION` for anything else.
 */
export function availableActions(
  status: AppointmentStatus,
  startsAt: string,
  now: DateTime,
): AppointmentActions {
  if (status !== 'Confirmed') return NO_ACTIONS;
  const started = now >= DateTime.fromISO(startsAt);
  return {
    reschedule: true,
    cancel: !started,
    complete: started,
    noShow: started,
  };
}
