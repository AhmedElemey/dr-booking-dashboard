import { HttpErrorResponse, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { DateTime } from 'luxon';
import { firstValueFrom } from 'rxjs';

import { API_ROOT } from '../config/api-url';
import { PHASE2_FEATURE_KEYS } from '../config/brand';
import { MockBackend } from './mock-backend';
import { MOCK_TZ } from './mock-data';

describe('mock backend (phase 2)', () => {
  let backend: MockBackend;

  async function call<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
    method: string,
    path: string,
    body: unknown = null,
    role = 'staff',
  ): Promise<T> {
    const [route, query = ''] = path.split('?');
    const req = new HttpRequest(method, `${API_ROOT}${route}`, body, {
      params: new HttpParams({ fromString: query }),
    }).clone({ setHeaders: { Authorization: `Bearer mock-access-${role}` } });
    const res = (await firstValueFrom(backend.handle(req))) as HttpResponse<T>;
    return res.body as T;
  }

  /** A list endpoint answers with a bare array or a page; both are fine. */
  const rowsOf = <R>(body: R[] | { items: R[] }): R[] => (Array.isArray(body) ? body : body.items);

  const fail = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (e) {
      return e as HttpErrorResponse;
    }
    throw new Error('expected the call to fail');
  };

  beforeEach(() => {
    backend = new MockBackend();
  });

  it('turns every phase 2 feature on', async () => {
    const { features } = await call<{ features: Record<string, boolean> }>('GET', '/features');
    for (const key of PHASE2_FEATURE_KEYS) expect(features[key]).toBe(true);
  });

  it('adds, lists, rejects duplicates of and deletes holidays', async () => {
    const created = await call('POST', '/dashboard/holidays', {
      date: '2026-12-05',
      nameAr: 'يوم العيادة',
      nameEn: 'Clinic day',
    });
    const duplicate = await fail(
      call('POST', '/dashboard/holidays', { date: '2026-12-05', nameAr: 'ا', nameEn: 'a' }),
    );
    expect(duplicate.status).toBe(400);
    const list = await call<{ id: string; date: string }[]>(
      'GET',
      '/dashboard/holidays?clinicId=x&year=2026',
    );
    expect(list.some((h) => h.id === created.id)).toBe(true);
    await call('DELETE', `/dashboard/holidays/${created.id}`);
    const after = await call<{ id: string }[]>('GET', '/dashboard/holidays?clinicId=x&year=2026');
    expect(after.some((h) => h.id === created.id)).toBe(false);
  });

  it('imports the Egyptian holidays and reports what it added', async () => {
    const result = await call<{ created: number; skipped: number }>(
      'POST',
      '/dashboard/holidays/import-egypt',
      { clinicId: 'x', year: 2027 },
    );
    expect(result.created).toBeGreaterThan(0);
    const again = await call<{ created: number; skipped: number }>(
      'POST',
      '/dashboard/holidays/import-egypt',
      { clinicId: 'x', year: 2027 },
    );
    expect(again.created).toBe(0);
    expect(again.skipped).toBeGreaterThan(0);
  });

  it('refunds a paid payment once', async () => {
    const rows = rowsOf(
      await call<{ id: string; status: string }[] | { items: { id: string; status: string }[] }>(
        'GET',
        '/dashboard/payments?from=2026-01-01&to=2026-12-31',
      ),
    );
    const paid = rows.find((p) => p.status === 'Paid');
    expect(paid).toBeTruthy();
    const refunded = await call<{ status: string }>(
      'POST',
      `/dashboard/payments/${paid!.id}/refund`,
    );
    expect(refunded.status).toBe('Refunded');
    const err = await fail(call('POST', `/dashboard/payments/${paid!.id}/refund`));
    expect(err.status).toBeGreaterThanOrEqual(400);
  });

  it('serves reports as JSON and as a CSV blob', async () => {
    const q = '?from=2026-10-01&to=2026-10-31&groupBy=Week';
    const bookings = await call('GET', `/dashboard/reports/bookings${q}`);
    expect(bookings).toBeTruthy();
    const csv = await call<Blob>('GET', `/dashboard/reports/revenue${q}&format=csv`);
    expect(csv instanceof Blob).toBe(true);
  });

  it('lists patients and filters by search', async () => {
    interface Row {
      fullName: string;
    }
    const rows = rowsOf(await call<Row[] | { items: Row[] }>('GET', '/dashboard/patients'));
    expect(rows.length).toBeGreaterThan(3);
    const first = rows[0].fullName.split(' ')[0];
    const found = rowsOf(
      await call<Row[] | { items: Row[] }>(
        'GET',
        `/dashboard/patients?search=${encodeURIComponent(first)}`,
      ),
    );
    expect(found.length).toBeGreaterThan(0);
  });

  it('hides a review and takes it back', async () => {
    const rows = rowsOf(
      await call<{ id: string }[] | { items: { id: string }[] }>('GET', '/dashboard/reviews'),
    );
    const id = rows[0].id;
    await call('POST', `/dashboard/reviews/${id}/hide`);
    await call('POST', `/dashboard/reviews/${id}/publish`);
  });

  it('returns patients as a bare array with X-Total-Count', async () => {
    const req = new HttpRequest('GET', `${API_ROOT}/dashboard/patients`).clone({
      setHeaders: { Authorization: 'Bearer mock-access-staff' },
    });
    const res = (await firstValueFrom(backend.handle(req))) as HttpResponse<unknown[]>;
    expect(Array.isArray(res.body)).toBe(true);
    expect(Number(res.headers.get('X-Total-Count'))).toBeGreaterThanOrEqual(res.body!.length);
  });

  it('sends the flat patientName on reviews', async () => {
    const rows = rowsOf(
      await call<{ patientName?: string }[] | { items: { patientName?: string }[] }>(
        'GET',
        '/dashboard/reviews',
      ),
    );
    expect(rows.every((r) => !!r.patientName)).toBe(true);
    expect(rows.some((r) => 'patient' in r)).toBe(false);
  });

  it('refuses refunds and review moderation to doctors, but lets them reply', async () => {
    const paid = rowsOf(
      await call<{ id: string; status: string }[]>(
        'GET',
        '/dashboard/payments?from=2026-01-01&to=2026-12-31',
      ),
    ).find((p) => p.status === 'Paid')!;
    expect(
      (await fail(call('POST', `/dashboard/payments/${paid.id}/refund`, null, 'doctor'))).status,
    ).toBe(403);
    const reviews = rowsOf(
      await call<{ id: string }[] | { items: { id: string }[] }>('GET', '/dashboard/reviews'),
    );
    expect(
      (await fail(call('POST', `/dashboard/reviews/${reviews[0].id}/hide`, null, 'doctor'))).status,
    ).toBe(403);
    await call('PUT', `/dashboard/reviews/${reviews[0].id}/reply`, { reply: 'Thanks' }, 'doctor');
  });

  it('validates templates like the API: 15-minute slot lengths and boundaries', async () => {
    const body = (slotMinutes: number, start = '09:00') => ({
      name: 'T',
      slotMinutes,
      rules: [{ dayOfWeek: 'Sunday', start, end: '14:00' }],
    });
    const bad = await fail(call('POST', '/dashboard/working-hours-templates', body(20)));
    expect(bad.status).toBe(400);
    expect(bad.error.errors.slotMinutes).toBeTruthy();
    const off = await fail(call('POST', '/dashboard/working-hours-templates', body(30, '09:10')));
    expect(off.error.errors['rules[0].start']).toBeTruthy();
    await call('POST', '/dashboard/working-hours-templates', body(45));
    // Doctors can list templates (to apply one) but not change them.
    await call('GET', '/dashboard/working-hours-templates', null, 'doctor');
    expect(
      (await fail(call('POST', '/dashboard/working-hours-templates', body(30), 'doctor'))).status,
    ).toBe(403);
  });

  it('reports a duplicate holiday as a field error', async () => {
    const holiday = { date: '2026-12-06', nameAr: 'ا', nameEn: 'a' };
    await call('POST', '/dashboard/holidays', holiday);
    const dup = await fail(call('POST', '/dashboard/holidays', holiday));
    expect(dup.error.errors.date).toEqual(['This date is already a holiday.']);
  });

  it('serves record attachments from an authorized API path and returns the upload url', async () => {
    const patients = rowsOf(await call<{ id: string }[]>('GET', '/dashboard/patients'));
    const detail = await call<{ records: { id: string; attachmentUrl?: string }[] }>(
      'GET',
      `/dashboard/patients/${patients.find((p) => p.id === 'pt-1')!.id}`,
    );
    const entry = detail.records.find((r) => r.attachmentUrl)!;
    expect(entry.attachmentUrl).toContain('/api/v1/dashboard/records/');
    const blob = await call<Blob>('GET', `/dashboard/records/${entry.id}/attachment`);
    expect(blob instanceof Blob).toBe(true);
    const up = await call<{ attachmentUrl: string }>(
      'PUT',
      `/dashboard/records/${entry.id}/attachment`,
      null,
    );
    expect(Object.keys(up)).toEqual(['attachmentUrl']);
  });

  it('mark-paid answers with the appointment and the dto has no paymentId', async () => {
    const appts = rowsOf(
      await call<
        | { id: string; paymentStatus: string; totalEgp: number; status: string }[]
        | { items: { id: string; paymentStatus: string; totalEgp: number; status: string }[] }
      >('GET', '/dashboard/appointments?from=2026-01-01&to=2027-12-31'),
    );
    const unpaid = appts.find(
      (a) => a.paymentStatus === 'Unpaid' && a.status !== 'Cancelled' && a.totalEgp > 0,
    )!;
    const res = await call<Record<string, unknown>>(
      'POST',
      `/dashboard/appointments/${unpaid.id}/mark-paid`,
    );
    expect(res['paymentStatus']).toBe('Paid');
    expect('paymentId' in res).toBe(false);
  });

  it('liveQueue: today\'s queue is ordered with the doctor first, then checked-in, then upcoming', async () => {
    const queue = await call<{ appointment: { status: string }; position: number }[]>(
      'GET',
      '/dashboard/appointments/queue',
    );
    if (queue.length === 0) return; // Friday: the demo clinic has no visits today
    expect(queue.map((e) => e.position)).toEqual(queue.map((_, i) => i + 1));
    const rank = (s: string) => (s === 'InProgress' ? 0 : s === 'CheckedIn' ? 1 : 2);
    const ranks = queue.map((e) => rank(e.appointment.status));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('liveQueue: check-in, start and complete move a visit through the day', async () => {
    const today = DateTime.now().setZone(MOCK_TZ).toISODate()!;
    const appts = rowsOf(
      await call<
        | { id: string; status: string; doctor: { id: string } }[]
        | { items: { id: string; status: string; doctor: { id: string } }[] }
      >('GET', `/dashboard/appointments?from=${today}&to=${today}&status=Confirmed`),
    );
    if (appts.length === 0) return; // Friday: the demo clinic has no visits today
    // A doctor who does not already have a patient with them.
    const queueNow = await call<{ appointment: { status: string; doctor: { id: string } } }[]>(
      'GET',
      '/dashboard/appointments/queue',
    );
    const busyDoctors = new Set(
      queueNow
        .filter((e) => e.appointment.status === 'InProgress')
        .map((e) => e.appointment.doctor.id),
    );
    const visit = appts.find((a) => !busyDoctors.has(a.doctor.id)) ?? appts[0];

    const checkedIn = await call<{ status: string; checkedInAt: string | null }>(
      'POST',
      `/dashboard/appointments/${visit.id}/check-in`,
    );
    expect(checkedIn.status).toBe('CheckedIn');
    expect(checkedIn.checkedInAt).toBeTruthy();

    const secondCheckIn = await fail(
      call('POST', `/dashboard/appointments/${visit.id}/check-in`),
    );
    expect(secondCheckIn.status).toBe(409);

    const started = await call<{ status: string; startedAt: string | null }>(
      'POST',
      `/dashboard/appointments/${visit.id}/start`,
    );
    expect(started.status).toBe('InProgress');
    expect(started.startedAt).toBeTruthy();

    const completed = await call<{ status: string }>(
      'POST',
      `/dashboard/appointments/${visit.id}/complete`,
    );
    expect(completed.status).toBe('Completed');

    const queue = await call<{ appointment: { id: string } }[]>(
      'GET',
      '/dashboard/appointments/queue',
    );
    expect(queue.some((e) => e.appointment.id === visit.id)).toBe(false);
  });

  it('liveQueue: one patient per doctor at a time', async () => {
    const today = DateTime.now().setZone(MOCK_TZ).toISODate()!;
    const queue = await call<
      { appointment: { status: string; doctor: { id: string } } }[]
    >('GET', '/dashboard/appointments/queue');
    const busyDoctors = new Set(
      queue
        .filter((e) => e.appointment.status === 'InProgress')
        .map((e) => e.appointment.doctor.id),
    );
    const appts = rowsOf(
      await call<
        | { id: string; status: string; doctor: { id: string } }[]
        | { items: { id: string; status: string; doctor: { id: string } }[] }
      >('GET', `/dashboard/appointments?from=${today}&to=${today}&status=Confirmed`),
    );
    const next = appts.find((a) => busyDoctors.has(a.doctor.id));
    if (!next) return; // no doctor with a visit in progress and another confirmed today
    await call('POST', `/dashboard/appointments/${next.id}/check-in`);
    const busy = await fail(call('POST', `/dashboard/appointments/${next.id}/start`));
    expect(busy.status).toBe(409);
  });
});
