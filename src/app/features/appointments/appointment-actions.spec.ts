import { DateTime } from 'luxon';

import { AppointmentStatus } from '../../core/api/models';
import { availableActions } from './appointment-actions';

const STARTS = '2026-11-02T07:00:00Z';
const before = DateTime.fromISO('2026-11-02T06:59:00Z');
const after = DateTime.fromISO('2026-11-02T07:01:00Z');

describe('availableActions (spec transition table)', () => {
  it('Pending can be approved or rejected, nothing else, before or after the start', () => {
    for (const now of [before, after]) {
      expect(availableActions('Pending', STARTS, now)).toEqual({
        approve: true,
        reject: true,
        reschedule: false,
        cancel: false,
        complete: false,
        noShow: false,
      });
    }
  });

  it('before the start: Confirmed can be rescheduled or cancelled, not completed or no-show', () => {
    expect(availableActions('Confirmed', STARTS, before)).toEqual({
      approve: false,
      reject: false,
      reschedule: true,
      cancel: true,
      complete: false,
      noShow: false,
    });
  });

  it('after the start: Confirmed can be completed or no-show, not cancelled', () => {
    expect(availableActions('Confirmed', STARTS, after)).toEqual({
      approve: false,
      reject: false,
      reschedule: true,
      cancel: false,
      complete: true,
      noShow: true,
    });
  });

  it('at the exact start time complete and no-show become available', () => {
    const exactly = DateTime.fromISO(STARTS);
    const actions = availableActions('Confirmed', STARTS, exactly);
    expect(actions.complete).toBe(true);
    expect(actions.noShow).toBe(true);
    expect(actions.cancel).toBe(false);
  });

  it.each<AppointmentStatus>(['Cancelled', 'Completed', 'NoShow'])(
    '%s is terminal: nothing is available',
    (status) => {
      for (const now of [before, after]) {
        expect(availableActions(status, STARTS, now)).toEqual({
          approve: false,
          reject: false,
          reschedule: false,
          cancel: false,
          complete: false,
          noShow: false,
        });
      }
    },
  );

  it('liveQueue: a checked-in visit can complete or no-show', () => {
    expect(availableActions('CheckedIn', STARTS, after)).toEqual({
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: true,
    });
  });

  it('liveQueue: a visit with the doctor can only complete', () => {
    expect(availableActions('InProgress', STARTS, after)).toEqual({
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: false,
    });
  });
});
