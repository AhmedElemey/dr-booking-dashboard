import { TestBed } from '@angular/core/testing';

import { flushDoctors, internals, pendingGet, setupPage } from '../../testing/phase2';
import { Messages } from './messages/messages';
import { Patients } from './patients/patients';
import { Payments } from './payments/payments';
import { Reviews } from './reviews/reviews';
import { WaitingList } from './waiting-list/waiting-list';

describe('WaitingList', () => {
  const entry = (status: string) => ({
    id: 'w1',
    patient: { id: 'p', fullName: 'Ali', phone: '+201000000001' },
    doctor: { id: 'd', name: 'Dr X' },
    date: '2026-11-20',
    status,
    createdAt: '2026-11-10T10:00:00Z',
  });

  it('lists entries and notifies a waiting patient', async () => {
    const h = setupPage(WaitingList);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/waiting-list').flush([entry('Waiting')]);
    await h.settle();
    expect(h.el.querySelector('tbody')?.textContent).toContain('Ali');
    (h.el.querySelector('tbody button') as HTMLButtonElement).click();
    const post = h.backend.expectOne((r) => r.method === 'POST');
    expect(post.request.url).toContain('/dashboard/waiting-list/w1/notify');
    post.flush(null);
    pendingGet(h.backend, '/dashboard/waiting-list').flush([entry('Notified')]);
    expect(h.snackOpen).toHaveBeenCalled();
  });

  it('only offers notify while the entry is open, and refilters on status', async () => {
    const h = setupPage(WaitingList);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/waiting-list').flush([entry('Booked')]);
    await h.settle();
    expect(h.el.querySelector('tbody button')).toBeNull();
    internals(h.fixture)['status'].set('Waiting');
    h.fixture.detectChanges();
    const req = pendingGet(h.backend, '/dashboard/waiting-list');
    expect(req.request.params.get('status')).toBe('Waiting');
    req.flush([]);
  });
});

describe('Payments', () => {
  const payment = (status: string) => ({
    id: 'pay1',
    appointmentId: 'a1',
    amountEgp: 300,
    status,
    method: 'Online',
    createdAt: '2026-11-10T10:00:00Z',
    paidAt: '2026-11-10T10:05:00Z',
    patient: { id: 'p', fullName: 'Mona' },
    doctor: { id: 'd', name: 'Dr X' },
    startsAt: '2026-11-12T10:00:00Z',
  });

  it('queries the last 30 days and shows rows', async () => {
    const h = setupPage(Payments);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    const req = pendingGet(h.backend, '/dashboard/payments');
    expect(req.request.params.get('from')).toBe('2026-10-16');
    expect(req.request.params.get('to')).toBe('2026-11-14');
    req.flush([payment('Paid')]);
    await h.settle();
    expect(h.el.querySelector('tbody')?.textContent).toContain('Mona');
  });

  it('refunds after confirmation and reloads', async () => {
    const h = setupPage(Payments, { role: 'ClinicStaff' });
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/payments').flush([payment('Paid')]);
    internals(h.fixture)['refund'](payment('Paid'));
    h.backend
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/payments/pay1/refund'))
      .flush(null);
    pendingGet(h.backend, '/dashboard/payments').flush([payment('Refunded')]);
    expect(h.snackOpen).toHaveBeenCalled();
  });

  it('shows the Refund button to staff but not to doctors', async () => {
    for (const [role, shown] of [
      ['ClinicStaff', true],
      ['Doctor', false],
    ] as const) {
      TestBed.resetTestingModule();
      const h = setupPage(Payments, { role });
      h.fixture.detectChanges();
      flushDoctors(h.backend);
      pendingGet(h.backend, '/dashboard/payments').flush([payment('Paid')]);
      await h.settle();
      expect(h.el.querySelector('tbody .danger-outline') !== null).toBe(shown);
    }
  });

  it('does not refund when the confirmation is dismissed', async () => {
    const h = setupPage(Payments, { dialogResults: [false] });
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/payments').flush([]);
    internals(h.fixture)['refund'](payment('Paid'));
    h.backend.expectNone((r) => r.method === 'POST');
  });
});

describe('Reviews', () => {
  const review = (status = 'Visible') => ({
    id: 'r1',
    doctor: { id: 'd', name: 'Dr X' },
    patientName: 'Sara',
    rating: 4,
    comment: 'Great',
    status,
    createdAt: '2026-11-10T10:00:00Z',
  });
  const page = (items: unknown[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });

  it('lists reviews with their comment', async () => {
    const h = setupPage(Reviews);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/reviews').flush(page([review()]));
    await h.settle();
    expect(h.el.textContent).toContain('Great');
  });

  it('shows the flat patientName the API sends', async () => {
    const h = setupPage(Reviews);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/reviews').flush(page([review()]));
    await h.settle();
    expect(h.el.querySelector('.who')?.textContent).toContain('Sara');
  });

  it('shows Hide/Publish to staff and only Reply to doctors', async () => {
    for (const [role, moderation] of [
      ['ClinicStaff', true],
      ['Doctor', false],
    ] as const) {
      TestBed.resetTestingModule();
      const h = setupPage(Reviews, { role });
      h.fixture.detectChanges();
      flushDoctors(h.backend);
      pendingGet(h.backend, '/dashboard/reviews').flush(
        page([review('Published'), { ...review('Hidden'), id: 'r2' }]),
      );
      await h.settle();
      const buttons = h.el.querySelectorAll('.actions button');
      expect(buttons.length).toBe(moderation ? 4 : 2);
      expect(h.el.textContent).toContain('Reply');
    }
  });

  it('hides, publishes and replies', async () => {
    const h = setupPage(Reviews, { role: 'ClinicStaff' });
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/reviews').flush(page([review()]));
    const api = internals(h.fixture);
    const step = (method: string, suffix: string, body?: unknown) => {
      const req = h.backend.expectOne((r) => r.method === method && r.url.endsWith(suffix));
      if (body) expect(req.request.body).toEqual(body);
      req.flush(null);
      pendingGet(h.backend, '/dashboard/reviews').flush(page([review()]));
    };
    api['hide'](review());
    step('POST', '/reviews/r1/hide');
    api['publish'](review('Hidden'));
    step('POST', '/reviews/r1/publish');
    api['startReply'](review());
    api['draft'].set('  Thank you  ');
    api['sendReply'](review());
    step('PUT', '/reviews/r1/reply', { reply: 'Thank you' });
  });

  it('ignores an empty reply', async () => {
    const h = setupPage(Reviews);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/reviews').flush(page([review()]));
    internals(h.fixture)['draft'].set('   ');
    internals(h.fixture)['sendReply'](review());
    h.backend.expectNone((r) => r.method === 'PUT');
  });

  it('filters by status and returns to page one', async () => {
    const h = setupPage(Reviews);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/reviews').flush(page([]));
    internals(h.fixture)['page'].set(3);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/reviews').flush(page([]));
    internals(h.fixture)['setStatus']('Hidden');
    h.fixture.detectChanges();
    const req = pendingGet(h.backend, '/dashboard/reviews');
    expect(req.request.params.get('status')).toBe('Hidden');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([]));
  });
});

describe('Messages', () => {
  it('lists the log and filters by channel', async () => {
    const h = setupPage(Messages);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/messages').flush({
      items: [
        {
          id: 'm1',
          channel: 'Sms',
          to: '+201000000001',
          kind: 'Reminder',
          body: 'See you tomorrow',
          status: 'Sent',
          createdAt: '2026-11-13T10:00:00Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });
    await h.settle();
    expect(h.el.textContent).toContain('See you tomorrow');
    internals(h.fixture)['setChannel']('WhatsApp');
    h.fixture.detectChanges();
    const req = pendingGet(h.backend, '/dashboard/messages');
    expect(req.request.params.get('channel')).toBe('WhatsApp');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });
});

describe('Patients', () => {
  it('searches by name or phone', async () => {
    const h = setupPage(Patients);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/patients').flush([
      { id: 'u1', fullName: 'Hoda', phone: '+201000000009', appointmentsCount: 3 },
    ]);
    await h.settle();
    expect(h.el.querySelector('tbody')?.textContent).toContain('Hoda');
    internals(h.fixture)['draft'].set('hod');
    internals(h.fixture)['submit']();
    h.fixture.detectChanges();
    const req = pendingGet(h.backend, '/dashboard/patients');
    expect(req.request.params.get('search')).toBe('hod');
    req.flush([]);
  });

  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `u${i}`,
      fullName: `Patient ${i}`,
      phone: '+201000000009',
      appointmentsCount: 1,
    }));

  it('pages from the X-Total-Count header', async () => {
    const h = setupPage(Patients);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/patients').flush(rows(20), {
      headers: { 'X-Total-Count': '45' },
    });
    await h.settle();
    expect(internals(h.fixture)['hasNext']()).toBe(true);
    expect(h.el.querySelector('.pager')).not.toBeNull();
    internals(h.fixture)['go'](3);
    h.fixture.detectChanges();
    const req = pendingGet(h.backend, '/dashboard/patients');
    expect(req.request.params.get('page')).toBe('3');
    req.flush(rows(5), { headers: { 'X-Total-Count': '45' } });
    await h.settle();
    expect(internals(h.fixture)['hasNext']()).toBe(false);
  });

  it('treats a full page as "maybe more" when the header is hidden', async () => {
    const h = setupPage(Patients);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/patients').flush(rows(20));
    await h.settle();
    expect(internals(h.fixture)['hasNext']()).toBe(true);
  });

  it('has no next page when a short page arrives without the header', async () => {
    const h = setupPage(Patients);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/patients').flush(rows(7));
    await h.settle();
    expect(internals(h.fixture)['hasNext']()).toBe(false);
  });
});
