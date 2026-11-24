import { HttpRequest } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { internals, pendingGet, setupPage } from '../../../testing/phase2';
import { FeaturesDialog } from './features-dialog';

const clinic = {
  id: 'c1',
  nameAr: 'عيادة النور',
  nameEn: 'Noor Clinic',
  addressAr: '',
  addressEn: '',
  city: 'Cairo',
  phone: '+201000000000',
  timezone: 'Africa/Cairo',
  isActive: true,
};

const payload = {
  clinicId: 'c1',
  depositAmountEgp: null,
  features: {
    reviews: { effective: true, hasOverride: false },
    reports: { effective: false, hasOverride: true },
  },
};

function dialogProviders() {
  const close = vi.fn();
  return {
    close,
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { clinic } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  };
}

describe('FeaturesDialog', () => {
  it('loads the clinic features and saves only the changed toggle with the deposit', async () => {
    const { close, providers } = dialogProviders();
    const h = setupPage(FeaturesDialog, { providers });
    h.fixture.detectChanges();
    pendingGet(h.backend, '/admin/clinics/c1/features').flush(payload);
    await h.settle();
    expect(h.el.textContent).toContain('Reviews');

    internals(h.fixture)['set']('reviews', false);
    internals(h.fixture)['deposit'] = 200;
    internals(h.fixture)['save']();
    const req = h.backend.expectOne(
      (r: HttpRequest<unknown>) => r.method === 'PUT' && r.url.endsWith('/admin/clinics/c1/features'),
    );
    expect(req.request.body).toEqual({ features: { reviews: false }, depositAmountEgp: 200 });
    req.flush(payload);
    await h.settle();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('sends null for a reset key', async () => {
    const { providers } = dialogProviders();
    const h = setupPage(FeaturesDialog, { providers });
    h.fixture.detectChanges();
    pendingGet(h.backend, '/admin/clinics/c1/features').flush(payload);
    await h.settle();

    internals(h.fixture)['reset']('reports');
    internals(h.fixture)['save']();
    const req = h.backend.expectOne(
      (r: HttpRequest<unknown>) => r.method === 'PUT' && r.url.endsWith('/admin/clinics/c1/features'),
    );
    expect(req.request.body).toEqual({ features: { reports: null } });
    req.flush(payload);
  });
});
