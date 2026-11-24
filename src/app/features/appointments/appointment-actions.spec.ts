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
      expect(availableActions('Pending', STARTS, ENDS, now)).toEqual({
        approve: true,
        reject: true,
        reschedule: false,
        cancel: false,
        complete: false,
        noShow: false,
        correct: null,
      });
    }
  });

  it('before the start: Confirmed can be rescheduled or cancelled, not completed or no-show', () => {
    expect(availableActions('Confirmed', STARTS, ENDS, before)).toEqual({
      approve: false,
      reject: false,
      reschedule: true,
      cancel: true,
      complete: false,
      noShow: false,
      correct: null,
    });
  });

  it('after the start: Confirmed can be completed or no-show, not cancelled', () => {
    expect(availableActions('Confirmed', STARTS, ENDS, after)).toEqual({
      approve: false,
      reject: false,
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
        approve: false,
        reject: false,
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
      const late = DateTime.fromISO('2026-11-03T07:30:01Z');
      expect(availableActions(status, STARTS, ENDS, late)).toEqual(NO_ACTIONS_EXPECTED);
    },
  );

  it('liveQueue: a checked-in visit can be cancelled but not closed out before the slot starts', () => {
    expect(availableActions('CheckedIn', STARTS, ENDS, before)).toEqual({
      approve: false,
      reject: false,
      reschedule: false,
      cancel: true,
      complete: false,
      noShow: false,
      correct: null,
    });
  });

  it('liveQueue: a checked-in visit can complete or no-show once the slot started', () => {
    expect(availableActions('CheckedIn', STARTS, ENDS, after)).toEqual({
      approve: false,
      reject: false,
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: true,
      correct: null,
    });
  });

  it('liveQueue: a visit with the doctor can only complete', () => {
    expect(availableActions('InProgress', STARTS, ENDS, after)).toEqual({
      approve: false,
      reject: false,
      reschedule: false,
      cancel: false,
      complete: true,
      noShow: false,
      correct: null,
    });
  });
});

const NO_ACTIONS_EXPECTED = {
  approve: false,
  reject: false,
  reschedule: false,
  cancel: false,
  complete: false,
  noShow: false,
  correct: null,
};
