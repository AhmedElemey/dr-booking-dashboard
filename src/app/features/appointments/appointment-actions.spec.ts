import { DateTime } from 'luxon';

import { AppointmentStatus } from '../../core/api/models';
import { availableActions } from './appointment-actions';

const STARTS = '2026-11-02T07:00:00Z';
const ENDS = '2026-11-02T07:30:00Z';
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
<<<<<<< hamada14/pending-approval-ui
    expect(availableActions('Confirmed', STARTS, before)).toEqual({
      approve: false,
      reject: false,
=======
    expect(availableActions('Confirmed', STARTS, ENDS, before)).toEqual({
>>>>>>> main
      reschedule: true,
      cancel: true,
      complete: false,
      noShow: false,
      correct: null,
    });
  });

  it('after the start: Confirmed can be completed or no-show, not cancelled', () => {
<<<<<<< hamada14/pending-approval-ui
    expect(availableActions('Confirmed', STARTS, after)).toEqual({
      approve: false,
      reject: false,
=======
    expect(availableActions('Confirmed', STARTS, ENDS, after)).toEqual({
>>>>>>> main
      reschedule: true,
      cancel: false,
      complete: true,
      noShow: true,
      correct: null,
    });
  });

  it('at the exact start time complete and no-show become available', () => {
    const exactly = DateTime.fromISO(STARTS);
    const actions = availableActions('Confirmed', STARTS, ENDS, exactly);
    expect(actions.complete).toBe(true);
    expect(actions.noShow).toBe(true);
    expect(actions.cancel).toBe(false);
  });

  it('Cancelled is terminal: nothing is available', () => {
    for (const now of [before, after]) {
      expect(availableActions('Cancelled', STARTS, ENDS, now)).toEqual({
        reschedule: false,
        cancel: false,
        complete: false,
        noShow: false,
        correct: null,
      });
    }
  });

  it.each([
    ['Completed' as const, 'NoShow' as const],
    ['NoShow' as const, 'Completed' as const],
  ])('%s can be corrected to %s within 24 hours of the visit end', (status, target) => {
    const within = DateTime.fromISO('2026-11-02T20:00:00Z');
    const actions = availableActions(status, STARTS, ENDS, within);
    expect(actions.correct).toBe(target);
    expect(actions.reschedule).toBe(false);
    expect(actions.cancel).toBe(false);
    expect(actions.complete).toBe(false);
    expect(actions.noShow).toBe(false);
  });

  it.each<AppointmentStatus>(['Completed', 'NoShow'])(
    '%s can no longer be corrected 24 hours after the visit end',
    (status) => {
<<<<<<< hamada14/pending-approval-ui
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
=======
      const late = DateTime.fromISO('2026-11-03T07:30:01Z');
      expect(availableActions(status, STARTS, ENDS, late)).toEqual(NO_ACTIONS_EXPECTED);
>>>>>>> main
    },
  );

  it('liveQueue: a checked-in visit can complete or no-show', () => {
<<<<<<< hamada14/pending-approval-ui
    expect(availableActions('CheckedIn', STARTS, after)).toEqual({
      approve: false,
      reject: false,
=======
    expect(availableActions('CheckedIn', STARTS, ENDS, after)).toEqual({
>>>>>>> main
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: true,
      correct: null,
    });
  });

  it('liveQueue: a visit with the doctor can only complete', () => {
<<<<<<< hamada14/pending-approval-ui
    expect(availableActions('InProgress', STARTS, after)).toEqual({
      approve: false,
      reject: false,
=======
    expect(availableActions('InProgress', STARTS, ENDS, after)).toEqual({
>>>>>>> main
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: false,
      correct: null,
    });
  });
});

const NO_ACTIONS_EXPECTED = {
  reschedule: false,
  cancel: false,
  complete: false,
  noShow: false,
  correct: null,
};
