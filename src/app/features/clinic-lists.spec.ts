import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { flushDoctors, internals, pendingGet, setupPage } from '../../testing/phase2';
import { CouponDialog } from './coupons/coupon-dialog';
import { Coupons } from './coupons/coupons';
import { InsuranceProviders, InsuranceProviderDialog } from './insurance/insurance-providers';

const dialogProviders = (data: unknown) => {
  const close = vi.fn();
  return {
    close,
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  };
};

describe('InsuranceProviders', () => {
  const provider = { id: 'i1', nameAr: 'مصر', nameEn: 'Misr Insurance', isActive: true };

  it('lists providers and deletes one after confirmation', async () => {
    const h = setupPage(InsuranceProviders);
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/insurance-providers').flush([provider]);
    await h.settle();
    expect(h.el.textContent).toContain('Misr Insurance');
    internals(h.fixture)['remove'](provider);
    h.backend
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/insurance-providers/i1'))
      .flush(null);
    pendingGet(h.backend, '/dashboard/insurance-providers').flush([]);
  });

  it('reloads after the add dialog saves', async () => {
    const h = setupPage(InsuranceProviders, { dialogResults: [provider] });
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/insurance-providers').flush([]);
    internals(h.fixture)['open']();
    pendingGet(h.backend, '/dashboard/insurance-providers').flush([provider]);
    expect(h.snackOpen).toHaveBeenCalled();
  });

  it('does nothing when the dialog is cancelled', async () => {
    const h = setupPage(InsuranceProviders, { dialogResults: [undefined] });
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/insurance-providers').flush([]);
    internals(h.fixture)['open']();
    h.backend.expectNone((r) => r.method === 'GET');
  });
});

describe('InsuranceProviderDialog', () => {
  it('requires both names and posts a trimmed body', () => {
    const d = dialogProviders(null);
    const h = setupPage(InsuranceProviderDialog, { providers: d.providers });
    h.fixture.detectChanges();
    internals(h.fixture)['save']();
    h.backend.expectNone(() => true);
    internals(h.fixture)['form'].patchValue({ nameAr: ' أ ', nameEn: ' A ' });
    internals(h.fixture)['save']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ nameAr: 'أ', nameEn: 'A', isActive: true });
    req.flush({ id: 'new' });
    expect(d.close).toHaveBeenCalled();
  });

  it('updates when editing', () => {
    const d = dialogProviders({ id: 'i9', nameAr: 'ا', nameEn: 'A', isActive: false });
    const h = setupPage(InsuranceProviderDialog, { providers: d.providers });
    h.fixture.detectChanges();
    internals(h.fixture)['save']();
    const req = h.backend.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/i9'));
    expect(req.request.body.isActive).toBe(false);
    req.flush({});
  });
});

describe('CouponDialog', () => {
  const open = (coupon: unknown = null) => {
    const d = dialogProviders({ coupon });
    const h = setupPage(CouponDialog, { providers: d.providers });
    h.fixture.detectChanges();
    return { h, d, form: internals(h.fixture)['form'] };
  };
  const fill = (form: ReturnType<typeof open>['form'], extra = {}) =>
    form.patchValue({
      code: 'WELCOME10',
      titleAr: 'ترحيب',
      titleEn: 'Welcome',
      validFrom: '2026-12-01',
      validTo: '2026-12-31',
      ...extra,
    });

  it('blocks saving an incomplete form', () => {
    const { h } = open();
    internals(h.fixture)['save']();
    h.backend.expectNone(() => true);
  });

  it('rejects malformed codes and reversed date windows', () => {
    const { form } = open();
    fill(form, { code: 'ab' });
    expect(form.controls.code.valid).toBe(false);
    fill(form, { code: 'GOOD-1', validFrom: '2026-12-31', validTo: '2026-12-01' });
    expect(form.valid).toBe(false);
    fill(form, { validFrom: '2026-12-01', validTo: '2026-12-31' });
    expect(form.valid).toBe(true);
  });

  it('caps a percentage at 100 but not a fixed amount', () => {
    const { form } = open();
    fill(form, { discountType: 'Percent', value: 150 });
    expect(form.controls.value.valid).toBe(false);
    fill(form, { discountType: 'Fixed', value: 150 });
    expect(form.controls.value.valid).toBe(true);
  });

  it('upper-cases the code and sends a clean request', () => {
    const { h, d, form } = open();
    fill(form, { code: 'spring25', value: 25, maxDiscountEgp: 100, maxRedemptions: 50 });
    internals(h.fixture)['upper']();
    internals(h.fixture)['save']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toMatchObject({
      code: 'SPRING25',
      discountType: 'Percent',
      value: 25,
      maxDiscountEgp: 100,
      maxRedemptions: 50,
      doctorId: null,
      serviceId: null,
    });
    req.flush({ id: 'c1' });
    expect(d.close).toHaveBeenCalled();
  });

  it('drops the cap for a fixed discount', () => {
    const { h, form } = open();
    fill(form, { discountType: 'Fixed', value: 50, maxDiscountEgp: 100 });
    internals(h.fixture)['save']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.body.maxDiscountEgp).toBeNull();
    req.flush({});
  });
});

describe('Coupons', () => {
  const coupon = {
    id: 'c1',
    code: 'WELCOME10',
    titleAr: 'ترحيب',
    titleEn: 'Welcome',
    discountType: 'Percent',
    value: 10,
    validFrom: '2026-11-01',
    validTo: '2026-12-31',
    perPatientLimit: 1,
    isPublic: true,
    isActive: true,
    redemptionsCount: 3,
  };

  it('lists coupons with their redemption count', async () => {
    const h = setupPage(Coupons);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/coupons').flush([coupon]);
    await h.settle();
    expect(h.el.textContent).toContain('WELCOME10');
    expect(h.el.textContent).toContain('10%');
  });

  it('deletes after confirmation', async () => {
    const h = setupPage(Coupons);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/coupons').flush([coupon]);
    internals(h.fixture)['remove'](coupon);
    h.backend.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/coupons/c1')).flush(null);
    pendingGet(h.backend, '/dashboard/coupons').flush([]);
  });
});
