import { flushDoctors, internals, pendingGet, setupPage } from '../../testing/phase2';
import { PatientRecord } from './patients/patient-record';
import { MAX_REPORT_DAYS, Reports } from './reports/reports';

const bookings = {
  series: [{ period: '2026-11-10', booked: 5, completed: 3, cancelled: 1, noShow: 1 }],
  totals: { booked: 5, completed: 3, cancelled: 1, noShow: 1, cancellationRate: 0.2 },
  byDoctor: [],
  byService: [],
  bySource: [],
};
const revenue = {
  series: [{ period: '2026-11-10', collected: 900, refunded: 100 }],
  totals: { collected: 900, refunded: 100, net: 800, pending: 0 },
  byDoctor: [],
};

describe('Reports', () => {
  async function open() {
    const h = setupPage(Reports);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    const b = pendingGet(h.backend, '/dashboard/reports/bookings');
    expect(b.request.params.get('from')).toBe('2026-10-16');
    expect(b.request.params.get('to')).toBe('2026-11-14');
    expect(b.request.params.get('groupBy')).toBe('Day');
    b.flush(bookings);
    pendingGet(h.backend, '/dashboard/reports/revenue').flush(revenue);
    await h.settle();
    return h;
  }

  it('loads bookings and revenue for the last 30 days', async () => {
    const h = await open();
    expect(h.el.querySelector('app-bar-chart')).not.toBeNull();
    expect(h.el.textContent).toContain('20');
  });

  it('reloads when the grouping changes', async () => {
    const h = await open();
    internals(h.fixture)['groupBy'].set('Week');
    h.fixture.detectChanges();
    expect(pendingGet(h.backend, '/dashboard/reports/bookings').request.params.get('groupBy')).toBe(
      'Week',
    );
    pendingGet(h.backend, '/dashboard/reports/revenue');
  });

  it('does not query an invalid or oversized range', async () => {
    const h = await open();
    internals(h.fixture)['from'].set('2026-12-01');
    h.fixture.detectChanges();
    h.backend.expectNone(() => true);
    expect(internals(h.fixture)['rangeValid']()).toBe(false);
    internals(h.fixture)['from'].set('2020-01-01');
    internals(h.fixture)['to'].set('2026-11-14');
    expect(MAX_REPORT_DAYS).toBe(366);
    expect(internals(h.fixture)['rangeValid']()).toBe(false);
  });

  it('downloads the CSV with the current filters', async () => {
    const create = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const h = await open();
    internals(h.fixture)['download']('revenue');
    const req = h.backend.expectOne(
      (r) => r.url.endsWith('/dashboard/reports/revenue') && r.params.get('format') === 'csv',
    );
    expect(req.request.params.get('from')).toBe('2026-10-16');
    req.flush(new Blob(['a,b']));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('PatientRecord', () => {
  const detail = {
    patient: { id: 'u1', fullName: 'Hoda Ali', phone: '+201000000009' },
    familyMembers: [],
    medicalInfo: { bloodType: 'O+', allergies: 'Penicillin' },
    appointments: [],
    records: [
      {
        id: 'e1',
        kind: 'Note',
        title: 'Follow-up note',
        visibleToPatient: false,
        createdAt: '2026-11-01T10:00:00Z',
      },
    ],
  };

  async function open() {
    const h = setupPage(PatientRecord);
    h.fixture.componentRef.setInput('id', 'u1');
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/patients/u1').flush(detail);
    await h.settle();
    return h;
  }

  it('shows the medical info and the timeline', async () => {
    const h = await open();
    expect(h.el.textContent).toContain('Hoda Ali');
    expect(h.el.textContent).toContain('Follow-up note');
    expect(internals(h.fixture)['medical'].controls.allergies.value).toBe('Penicillin');
  });

  it('saves the medical info with empty fields as null', async () => {
    const h = await open();
    internals(h.fixture)['medical'].patchValue({ medications: '  ', allergies: ' Dust ' });
    internals(h.fixture)['saveMedical']();
    const req = h.backend.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/medical-info'));
    expect(req.request.body).toEqual({
      bloodType: 'O+',
      allergies: 'Dust',
      chronicConditions: null,
      medications: null,
      familyMemberId: null,
    });
    req.flush({});
    pendingGet(h.backend, '/dashboard/patients/u1').flush(detail);
  });

  it('deletes an entry after confirmation', async () => {
    const h = await open();
    internals(h.fixture)['remove'](detail.records[0]);
    h.backend.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/records/e1')).flush(null);
    pendingGet(h.backend, '/dashboard/patients/u1').flush(detail);
  });
});
