import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_ROOT } from '../config/api-url';
import { CouponsApi } from './coupons.api';
import { HolidaysApi } from './holidays.api';
import { InsuranceApi } from './insurance.api';
import { MessagesApi } from './messages.api';
import { paramsOf, toPage } from './paging';
import { PatientsApi } from './patients.api';
import { PaymentsApi } from './payments.api';
import { RecallApi } from './recall.api';
import { ReportsApi } from './reports.api';
import { ReviewsApi } from './reviews.api';
import { WaitingListApi } from './waiting-list.api';
import { WorkingHoursApi, normalizeDay } from './working-hours.api';

describe('Phase 2 API services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectReq(method: string, path: string, body?: unknown, flush: unknown = null) {
    const req = http.expectOne((r) => r.method === method && r.url === `${API_ROOT}${path}`);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(flush as never);
    return req.request;
  }

  it('toPage accepts arrays, pages and nothing', () => {
    expect(toPage([1, 2])).toEqual({ items: [1, 2], totalCount: 2, page: 1, pageSize: 2 });
    expect(toPage({ items: [1], totalCount: 40, page: 2, pageSize: 20 }, 2).totalCount).toBe(40);
    expect(toPage(null).items).toEqual([]);
  });

  it('paramsOf skips empty values', () => {
    const p = paramsOf({ a: 'x', b: '', c: null, d: undefined, e: 0, f: false });
    expect(p.keys().sort()).toEqual(['a', 'e', 'f']);
  });

  it('normalizeDay maps numbers and names', () => {
    expect(normalizeDay(0)).toBe('Sunday');
    expect(normalizeDay(6)).toBe('Saturday');
    expect(normalizeDay('monday')).toBe('Monday');
    expect(normalizeDay('nonsense')).toBe('Sunday');
  });

  it('holidays', () => {
    const api = TestBed.inject(HolidaysApi);
    api.list('c1', 2026).subscribe();
    expect(expectReq('GET', '/dashboard/holidays').params.toString()).toBe('clinicId=c1&year=2026');
    api.create({ clinicId: 'c1', date: '2026-12-01', name: 'x' } as never).subscribe();
    expectReq('POST', '/dashboard/holidays');
    api.delete('h1').subscribe();
    expectReq('DELETE', '/dashboard/holidays/h1');
    api.importEgypt('c1', 2027).subscribe();
    expectReq('POST', '/dashboard/holidays/import-egypt', { clinicId: 'c1', year: 2027 });
    api.conflicts('h1').subscribe();
    expectReq('GET', '/dashboard/holidays/h1/conflicts', undefined, []);
  });

  it('working hours normalizes days and applies templates', () => {
    const api = TestBed.inject(WorkingHoursApi);
    let result: { rules: { dayOfWeek: string }[] }[] = [];
    api.list().subscribe((l) => (result = l as never));
    expectReq('GET', '/dashboard/working-hours-templates', undefined, [
      { id: 't', name: 'n', rules: [{ dayOfWeek: 1, start: '09:00', end: '10:00' }] },
    ]);
    expect(result[0].rules[0].dayOfWeek).toBe('Monday');
    api.create({ name: 'n', rules: [] } as never).subscribe();
    expectReq('POST', '/dashboard/working-hours-templates', undefined, { rules: [] });
    api.update('t', { name: 'n', rules: [] } as never).subscribe();
    expectReq('PUT', '/dashboard/working-hours-templates/t', undefined, { rules: [] });
    api.delete('t').subscribe();
    expectReq('DELETE', '/dashboard/working-hours-templates/t');
    api.apply('d1', { templateId: 't', fromDate: 'a', toDate: 'b' } as never).subscribe();
    expectReq('POST', '/dashboard/doctors/d1/slots/apply-template');
  });

  it('waiting list, payments, reviews, messages, patients send filters', () => {
    TestBed.inject(WaitingListApi)
      .list({ status: 'Waiting', doctorId: '' } as never)
      .subscribe();
    expect(expectReq('GET', '/dashboard/waiting-list', undefined, []).params.toString()).toBe(
      'status=Waiting',
    );
    TestBed.inject(WaitingListApi).notify('w1').subscribe();
    expectReq('POST', '/dashboard/waiting-list/w1/notify', {});

    const pay = TestBed.inject(PaymentsApi);
    pay.list({ status: 'Paid', page: 2 } as never).subscribe();
    expect(expectReq('GET', '/dashboard/payments', undefined, []).params.toString()).toBe(
      'status=Paid&page=2',
    );
    pay.markPaid('a1').subscribe();
    expectReq('POST', '/dashboard/appointments/a1/mark-paid', {});
    pay.refund('p1').subscribe();
    expectReq('POST', '/dashboard/payments/p1/refund', {});

    const reviews = TestBed.inject(ReviewsApi);
    reviews.list({ status: 'Visible' } as never).subscribe();
    expectReq('GET', '/dashboard/reviews', undefined, []);
    reviews.hide('r1').subscribe();
    expectReq('POST', '/dashboard/reviews/r1/hide', {});
    reviews.publish('r1').subscribe();
    expectReq('POST', '/dashboard/reviews/r1/publish', {});
    reviews.reply('r1', 'thanks').subscribe();
    expectReq('PUT', '/dashboard/reviews/r1/reply', { reply: 'thanks' });

    TestBed.inject(MessagesApi)
      .list({ channel: 'Sms' } as never)
      .subscribe();
    expectReq('GET', '/dashboard/messages', undefined, { items: [], totalCount: 0 });

    const patients = TestBed.inject(PatientsApi);
    patients.list('  ali ', 3).subscribe();
    expect(expectReq('GET', '/dashboard/patients', undefined, []).params.toString()).toBe(
      'search=ali&page=3',
    );
    patients.get('u1', 'f1').subscribe();
    expect(expectReq('GET', '/dashboard/patients/u1').params.toString()).toBe('familyMemberId=f1');
  });

  it('patient records', () => {
    const api = TestBed.inject(PatientsApi);
    api.saveMedicalInfo('u1', { bloodType: 'A+' } as never, null).subscribe();
    expectReq('PUT', '/dashboard/patients/u1/medical-info', {
      bloodType: 'A+',
      familyMemberId: null,
    });
    api.createRecord('u1', { title: 't' } as never).subscribe();
    expectReq('POST', '/dashboard/patients/u1/records');
    api.updateRecord('e1', { title: 't' } as never).subscribe();
    expectReq('PUT', '/dashboard/records/e1');
    api.deleteRecord('e1').subscribe();
    expectReq('DELETE', '/dashboard/records/e1');
    api.uploadAttachment('e1', new File(['x'], 'a.pdf')).subscribe();
    const req = http.expectOne(`${API_ROOT}/dashboard/records/e1/attachment`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({});
  });

  it('insurance', () => {
    const api = TestBed.inject(InsuranceApi);
    api.list().subscribe();
    expectReq('GET', '/dashboard/insurance-providers', undefined, []);
    api.create({ name: 'a' } as never).subscribe();
    expectReq('POST', '/dashboard/insurance-providers');
    api.update('i1', { name: 'a' } as never).subscribe();
    expectReq('PUT', '/dashboard/insurance-providers/i1');
    api.delete('i1').subscribe();
    expectReq('DELETE', '/dashboard/insurance-providers/i1');
    api.setDoctorProviders('d1', ['i1']).subscribe();
    expectReq('PUT', '/dashboard/doctors/d1/insurance-providers', { providerIds: ['i1'] });
    api.decide('a1', 'Approved', 'ok').subscribe();
    expectReq('POST', '/dashboard/appointments/a1/insurance', { status: 'Approved', note: 'ok' });
  });

  it('coupons and recall', () => {
    const c = TestBed.inject(CouponsApi);
    c.list().subscribe();
    expectReq('GET', '/dashboard/coupons', undefined, []);
    c.create({} as never).subscribe();
    expectReq('POST', '/dashboard/coupons');
    c.update('c1', {} as never).subscribe();
    expectReq('PUT', '/dashboard/coupons/c1');
    c.delete('c1').subscribe();
    expectReq('DELETE', '/dashboard/coupons/c1');
    c.redemptions('c1').subscribe();
    expectReq('GET', '/dashboard/coupons/c1/redemptions', undefined, []);

    const r = TestBed.inject(RecallApi);
    r.list().subscribe();
    expectReq('GET', '/dashboard/recall-campaigns', undefined, []);
    r.create({} as never).subscribe();
    expectReq('POST', '/dashboard/recall-campaigns');
    r.update('k', {} as never).subscribe();
    expectReq('PUT', '/dashboard/recall-campaigns/k');
    r.delete('k').subscribe();
    expectReq('DELETE', '/dashboard/recall-campaigns/k');
    r.preview('k').subscribe();
    expectReq('POST', '/dashboard/recall-campaigns/k/preview', {});
    r.sendNow('k').subscribe();
    expectReq('POST', '/dashboard/recall-campaigns/k/send-now', {});
    r.sends('k', 2).subscribe();
    expectReq('GET', '/dashboard/recall-campaigns/k/sends', undefined, []);
  });

  it('reports', () => {
    const api = TestBed.inject(ReportsApi);
    const q = { from: '2026-11-01', to: '2026-11-14', doctorId: '' } as never;
    api.bookings(q).subscribe();
    expect(expectReq('GET', '/dashboard/reports/bookings').params.toString()).toBe(
      'from=2026-11-01&to=2026-11-14',
    );
    api.revenue(q).subscribe();
    expectReq('GET', '/dashboard/reports/revenue');
    api.csv('revenue', q).subscribe();
    const req = http.expectOne((r) => r.url === `${API_ROOT}/dashboard/reports/revenue`);
    expect(req.request.params.get('format')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });
});
