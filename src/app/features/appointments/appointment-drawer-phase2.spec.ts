import { internals, pendingGet, setupPage } from '../../../testing/phase2';
import { AppointmentDrawer } from './appointment-drawer';

const appointment = (extra: object = {}) => ({
  id: 'a1',
  status: 'Confirmed',
  slotId: 's1',
  startsAt: '2026-11-20T08:00:00Z',
  endsAt: '2026-11-20T08:30:00Z',
  startsAtLocal: '2026-11-20T10:00:00+02:00',
  timezone: 'Africa/Cairo',
  doctor: { id: 'd1', name: 'Dr X' },
  patient: { id: 'p1', fullName: 'Ali Hassan', phone: '+201000000001' },
  service: null,
  patientNote: null,
  cancelledBy: null,
  cancelReason: null,
  mode: 'Video',
  priceEgp: 400,
  discountEgp: 100,
  totalEgp: 300,
  paymentStatus: 'Unpaid',
  familyMember: { id: 'f1', fullName: 'Little Ali', relation: 'Child' },
  insurance: {
    provider: { id: 'i1', name: 'Misr Insurance' },
    memberNumber: 'M-1',
    status: 'Pending',
  },
  review: {
    rating: 5,
    comment: 'Wonderful',
    status: 'Published',
    createdAt: '2026-11-21T10:00:00Z',
  },
  ...extra,
});

async function open(features: string[], extra: object = {}) {
  const h = setupPage(AppointmentDrawer, { features });
  h.fixture.componentRef.setInput('appointmentId', 'a1');
  h.fixture.detectChanges();
  pendingGet(h.backend, '/dashboard/appointments/a1').flush(appointment(extra));
  await h.settle();
  return h;
}

describe('AppointmentDrawer phase 2 blocks', () => {
  it('shows none of them while their features are off', async () => {
    const h = await open([]);
    const text = h.el.textContent ?? '';
    expect(text).not.toContain('Misr Insurance');
    expect(text).not.toContain('Little Ali');
    expect(text).not.toContain('Wonderful');
    expect(h.el.querySelector('.join')).toBeNull();
  });

  it('shows family, video, payment, insurance and review when on', async () => {
    const h = await open([
      'familyAccounts',
      'videoConsultation',
      'onlinePayments',
      'insurance',
      'reviews',
    ]);
    const text = h.el.textContent ?? '';
    expect(text).toContain('Little Ali');
    expect(text).toContain('Misr Insurance');
    expect(text).toContain('Wonderful');
    expect(h.el.querySelector('.join')).not.toBeNull();
  });

  it('hides the join button for an in-person visit', async () => {
    const h = await open(['videoConsultation'], { mode: 'InPerson' });
    expect(h.el.querySelector('.join')).toBeNull();
  });

  it('opens the host link in a new tab', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);
    const h = await open(['videoConsultation']);
    internals(h.fixture)['joinVideo']();
    h.backend
      .expectOne((r) => r.url.endsWith('/dashboard/appointments/a1/video'))
      .flush({ joinUrl: 'https://meet.example/x', opensAt: 'a', closesAt: 'b' });
    expect(windowOpen).toHaveBeenCalledWith('https://meet.example/x', '_blank', 'noopener');
    windowOpen.mockRestore();
  });

  it('marks a cash payment and refetches', async () => {
    const h = await open(['onlinePayments']);
    expect(internals(h.fixture)['canMarkPaid']()).toBe(true);
    internals(h.fixture)['markPaid']();
    h.backend
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/appointments/a1/mark-paid'))
      .flush(null);
    pendingGet(h.backend, '/dashboard/appointments/a1').flush(
      appointment({ paymentStatus: 'Paid' }),
    );
    expect(internals(h.fixture)['canRefund']()).toBe(true);
    expect(internals(h.fixture)['canMarkPaid']()).toBe(false);
  });

  it('refunds using the payment id from the appointment', async () => {
    const h = await open(['onlinePayments'], { paymentStatus: 'Paid', paymentId: 'pay9' });
    internals(h.fixture)['refund']();
    h.backend
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/payments/pay9/refund'))
      .flush(null);
    pendingGet(h.backend, '/dashboard/appointments/a1').flush(
      appointment({ paymentStatus: 'Refunded' }),
    );
  });

  it('finds the payment through the list when the id is missing', async () => {
    const h = await open(['onlinePayments'], { paymentStatus: 'Paid' });
    internals(h.fixture)['refund']();
    const list = pendingGet(h.backend, '/dashboard/payments');
    expect(list.request.params.get('status')).toBe('Paid');
    list.flush([{ id: 'pay7', appointmentId: 'a1' }]);
    h.backend
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/payments/pay7/refund'))
      .flush(null);
    pendingGet(h.backend, '/dashboard/appointments/a1').flush(appointment());
  });

  it('approves insurance with a note', async () => {
    const h = await open(['insurance']);
    internals(h.fixture)['insuranceNote'] = ' covered ';
    internals(h.fixture)['decideInsurance']('Approved');
    const req = h.backend.expectOne((r) => r.url.endsWith('/appointments/a1/insurance'));
    expect(req.request.body).toEqual({ status: 'Approved', note: 'covered' });
    req.flush({});
    pendingGet(h.backend, '/dashboard/appointments/a1').flush(appointment());
  });
});
