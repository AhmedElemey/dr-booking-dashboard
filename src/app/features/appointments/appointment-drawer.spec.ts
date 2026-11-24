import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import en from '../../../../public/i18n/en.json';
import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { CurrentUser, DashboardAppointment } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { API_ROOT } from '../../core/config/api-url';
import { AppointmentDrawer } from './appointment-drawer';

const clinicAdmin: CurrentUser = {
  id: 'u1',
  phone: '+201000000001',
  fullName: 'Admin',
  role: 'ClinicStaff',
  preferredLanguage: 'en',
  clinicId: 'c1',
  isClinicAdmin: true,
};

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

  async function open(now: string, a: DashboardAppointment, user: CurrentUser = clinicAdmin) {
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
    TestBed.inject(AuthService).user.set(user);
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

  it('shows no actions for a terminal appointment older than 24 hours', async () => {
    const { el, buttons } = await open('2026-11-04T10:00:00', appointment({ status: 'Completed' }));
    expect(buttons()).toEqual([]);
    expect(el.textContent).toContain(en.drawer.final);
  });

  it('a recently completed visit offers a correction to no-show with a reason', async () => {
    const { fixture, el, buttons } = await open(
      '2026-11-02T10:00:00',
      appointment({ status: 'Completed' }),
    );
    expect(buttons().join('|')).toContain(en.drawer.correctToNoShow);

    const correctBtn = [...el.querySelectorAll<HTMLButtonElement>('.actions button')].find((b) =>
      b.textContent!.includes(en.drawer.correctToNoShow),
    )!;
    correctBtn.click();
    fixture.detectChanges();
    const textarea = el.querySelector('textarea')!;
    textarea.value = 'Patient arrived late';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.row button')]
      .find((b) => b.textContent!.includes(en.drawer.correctConfirm))!
      .click();

    const req = backend.expectOne(`${API_ROOT}/dashboard/appointments/a1/correct-status`);
    expect(req.request.body).toEqual({ toStatus: 'NoShow', reason: 'Patient arrived late' });
    req.flush(appointment({ status: 'NoShow' }));
    backend
      .expectOne(`${API_ROOT}/dashboard/appointments/a1`)
      .flush(appointment({ status: 'NoShow' }));
    await fixture.whenStable();
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

  it('reception staff who are not clinic admins get no correction button', async () => {
    const { buttons } = await open('2026-11-02T10:00:00', appointment({ status: 'Completed' }), {
      ...clinicAdmin,
      isClinicAdmin: false,
    });
    expect(buttons().join('|')).not.toContain(en.drawer.correctToNoShow);
  });

  it('a doctor can correct a closed visit', async () => {
    const { buttons } = await open('2026-11-02T10:00:00', appointment({ status: 'Completed' }), {
      ...clinicAdmin,
      role: 'Doctor',
      isClinicAdmin: undefined,
    });
    expect(buttons().join('|')).toContain(en.drawer.correctToNoShow);
  });
});
