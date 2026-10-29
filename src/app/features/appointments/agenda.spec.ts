import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { DashboardAppointment } from '../../core/api/models';
import { API_ROOT } from '../../core/config/api-url';
import { Agenda } from './agenda';

const row = (
  id: string,
  startsAt: string,
  status: DashboardAppointment['status'],
): DashboardAppointment => ({
  id,
  status,
  slotId: `s-${id}`,
  startsAt,
  endsAt: startsAt,
  timezone: 'Africa/Cairo',
  doctor: { id: 'd1', name: 'Dr. Sara' },
  patient: { id: 'p', fullName: `Patient ${id}`, phone: '+201001234567' },
});

describe('Agenda', () => {
  it('loads today in the clinic zone, lists rows with clinic-local times, and refetches on filter change', async () => {
    TestBed.configureTestingModule({
      imports: [Agenda],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        // 23:30 UTC on the 2nd is already the 3rd in Cairo.
        provideFixedClock('2026-11-03T01:30:00'),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Agenda);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0)); // the 60s poll timer fires immediately once
    fixture.detectChanges();

    backend.expectOne(`${API_ROOT}/dashboard/doctors`).flush([]);
    const req = backend.expectOne((r) => r.url === `${API_ROOT}/dashboard/appointments`);
    expect(req.request.params.get('from')).toBe('2026-11-03');
    expect(req.request.params.get('to')).toBe('2026-11-03');
    req.flush({
      items: [
        row('1', '2026-11-03T07:00:00Z', 'Confirmed'),
        row('2', '2026-11-03T07:30:00Z', 'Completed'),
      ],
      page: 1,
      pageSize: 100,
      totalCount: 2,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('09:00');
    expect(rows[0].textContent).toContain('Patient 1');
    expect(rows[1].textContent).toContain('Completed');

    // Switching to the week view widens the range to Saturday..Friday.
    (fixture.componentInstance as unknown as { view: { set(v: string): void } }).view.set('week');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    const weekReq = backend.expectOne((r) => r.url === `${API_ROOT}/dashboard/appointments`);
    expect(weekReq.request.params.get('from')).toBe('2026-10-31');
    expect(weekReq.request.params.get('to')).toBe('2026-11-06');
    weekReq.flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    fixture.destroy();
    backend.verify();
  });
});
