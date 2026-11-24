import { HttpRequest } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { internals, pendingGet, setupPage } from '../../../testing/phase2';
import { UserDialog } from './user-dialog';

function open() {
  const close = vi.fn();
  const h = setupPage(UserDialog, {
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { clinicId: 'c1', clinicName: 'Noor' } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  h.fixture.detectChanges();
  pendingGet(h.backend, '/specialties').flush([]);
  return { h, close };
}

describe('UserDialog', () => {
  it('sends isAdmin for a clinic staff account', async () => {
    const { h, close } = open();
    await h.settle();
    const form = internals(h.fixture)['form'];
    form.controls.role.setValue('ClinicStaff');
    form.controls.fullName.setValue('Mona');
    form.controls.phone.setValue('01012345678');
    form.controls.isAdmin.setValue(true);
    internals(h.fixture)['save']();
    const req = h.backend.expectOne(
      (r: HttpRequest<unknown>) => r.method === 'POST' && r.url.endsWith('/admin/clinics/c1/users'),
    );
    expect((req.request.body as Record<string, unknown>)['isAdmin']).toBe(true);
    req.flush({ id: 'u1', phone: '+201012345678', fullName: 'Mona', role: 'ClinicStaff', isActive: true, isAdmin: true });
    await h.settle();
    expect(close).toHaveBeenCalled();
  });

  it('omits isAdmin for a doctor account', async () => {
    const { h } = open();
    await h.settle();
    const form = internals(h.fixture)['form'];
    form.controls.role.setValue('Doctor');
    form.controls.fullName.setValue('Dr Omar');
    form.controls.phone.setValue('01012345679');
    form.controls.nameAr.setValue('د عمر');
    form.controls.nameEn.setValue('Dr Omar');
    form.controls.specialtyId.setValue('s1');
    internals(h.fixture)['save']();
    const req = h.backend.expectOne(
      (r: HttpRequest<unknown>) => r.method === 'POST' && r.url.endsWith('/admin/clinics/c1/users'),
    );
    expect(req.request.body).not.toHaveProperty('isAdmin');
    req.flush({ id: 'u2', phone: '+201012345679', fullName: 'Dr Omar', role: 'Doctor', isActive: true, isAdmin: null });
  });
});
