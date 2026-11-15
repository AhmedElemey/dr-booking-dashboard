import { HttpErrorResponse, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_ROOT } from '../config/api-url';
import { PHASE2_FEATURE_KEYS } from '../config/brand';
import { MockBackend } from './mock-backend';

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
});
