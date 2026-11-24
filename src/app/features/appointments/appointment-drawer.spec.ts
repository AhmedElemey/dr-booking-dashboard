import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import en from '../../../../public/i18n/en.json';
import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { DashboardAppointment } from '../../core/api/models';
import { API_ROOT } from '../../core/config/api-url';
import { AppointmentDrawer } from './appointment-drawer';

const appointment = (over: Partial<DashboardAppointment> = {}): DashboardAppointment => ({
  id: 'a1',
  status: 'Confirmed',
  slotId: 's1',
  startsAt: '2026-11-02T07:00:00Z', // 09:00 in Cairo
  endsAt: '2026-11-02T07:30:00Z',
  timezone: 'Africa/Cairo',
  doctor: { id: 'd1', name: 'Dr. Sara' },
  patient: { id: 'p1', fullName: 'Ahmed', phone: '+201001234567' },
  service: null,
  ...over,
});

@Component({
  imports: [AppointmentDrawer],
  template: `<app-appointment-drawer appointmentId="a1" (changed)="changes.set(changes() + 1)" />`,
})
class Host {
  changes = signal(0);
}

describe('AppointmentDrawer', () => {
  let backend: HttpTestingController;

  async function open(now: string, a: DashboardAppointment) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        provideFixedClock(now),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    backend.expectOne(`${API_ROOT}/dashboard/appointments/a1`).flush(a);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () =>
      [...el.querySelectorAll('.actions button')].map((b) => b.textContent!.trim());
    return { fixture, el, buttons, host: fixture.componentInstance };
  }

  it('shows the time in the clinic timezone', async () => {
    const { el } = await open('2026-11-02T08:00:00', appointment());
    expect(el.textContent).toContain('09:00 - 09:30');
    expect(el.textContent).toContain('Ahmed');
  });

  it('before the start offers reschedule and cancel only', async () => {
    const { buttons } = await open('2026-11-02T08:00:00', appointment());
    expect(buttons().join('|')).toContain(en.drawer.reschedule);
    expect(buttons().join('|')).toContain(en.drawer.cancel);
    expect(buttons().join('|')).not.toContain(en.drawer.complete);
    expect(buttons().join('|')).not.toContain(en.drawer.noShow);
  });

  it('after the start offers complete and no-show instead of cancel', async () => {
    const { buttons } = await open('2026-11-02T10:00:00', appointment());
    const text = buttons().join('|');
    expect(text).toContain(en.drawer.complete);
    expect(text).toContain(en.drawer.noShow);
    expect(text).not.toContain(en.drawer.cancel + '|');
  });

  it('shows no actions for a terminal appointment', async () => {
    const { el, buttons } = await open('2026-11-02T10:00:00', appointment({ status: 'Completed' }));
    expect(buttons()).toEqual([]);
    expect(el.textContent).toContain(en.drawer.final);
  });

  it('a pending booking offers approve and reject only', async () => {
    const { buttons } = await open('2026-11-02T08:00:00', appointment({ status: 'Pending' }));
    const text = buttons().join('|');
    expect(text).toContain(en.drawer.approve);
    expect(text).toContain(en.drawer.reject);
    expect(text).not.toContain(en.drawer.reschedule);
    expect(text).not.toContain(en.drawer.complete);
  });

  it('approves a pending booking through the approve endpoint', async () => {
    const { fixture, el, host } = await open(
      '2026-11-02T08:00:00',
      appointment({ status: 'Pending' }),
    );
    [...el.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((b) => b.textContent!.includes(en.drawer.approve))!
      .click();

    const req = backend.expectOne(`${API_ROOT}/dashboard/appointments/a1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush(appointment({ status: 'Confirmed' }));
    backend
      .expectOne(`${API_ROOT}/dashboard/appointments/a1`)
      .flush(appointment({ status: 'Confirmed' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.changes()).toBe(1);
    expect(el.textContent).toContain(en.status.Confirmed);
  });

  it('rejects a pending booking with a reason', async () => {
    const { fixture, el, host } = await open(
      '2026-11-02T08:00:00',
      appointment({ status: 'Pending' }),
    );
    [...el.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((b) => b.textContent!.includes(en.drawer.reject))!
      .click();
    fixture.detectChanges();
    const textarea = el.querySelector('textarea')!;
    textarea.value = 'Doctor is on leave';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.row .danger')!.click();

    const req = backend.expectOne(`${API_ROOT}/dashboard/appointments/a1/reject`);
    expect(req.request.body).toEqual({ reason: 'Doctor is on leave' });
    req.flush(appointment({ status: 'Cancelled', cancelledBy: 'Clinic' }));
    backend.expectOne(`${API_ROOT}/dashboard/appointments/a1`).flush(
      appointment({ status: 'Cancelled', cancelledBy: 'Clinic', cancelReason: 'Doctor is on leave' }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.changes()).toBe(1);
    expect(el.textContent).toContain(en.status.Cancelled);
  });

  it('cancels with a reason via the clinic endpoint', async () => {
    const { fixture, el, host } = await open('2026-11-02T08:00:00', appointment());
    const cancelBtn = [...el.querySelectorAll<HTMLButtonElement>('.actions button')].find((b) =>
      b.textContent!.includes(en.drawer.cancel),
    )!;
    cancelBtn.click();
    fixture.detectChanges();
    const textarea = el.querySelector('textarea')!;
    textarea.value = 'Doctor unavailable';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.row .danger')!.click();

    const req = backend.expectOne(`${API_ROOT}/dashboard/appointments/a1/cancel`);
    expect(req.request.body).toEqual({ reason: 'Doctor unavailable' });
    req.flush(appointment({ status: 'Cancelled' }));
    backend.expectOne(`${API_ROOT}/dashboard/appointments/a1`).flush(
      appointment({
        status: 'Cancelled',
        cancelledBy: 'Clinic',
        cancelReason: 'Doctor unavailable',
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.changes()).toBe(1);
    expect(el.textContent).toContain(en.status.Cancelled);
  });
});
