import { answer, setupPage } from '../../../testing/phase2';
import { ClinicSettings } from './clinic-settings';

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
  showPrices: true,
};

async function open(publicPrices: boolean) {
  const h = setupPage(ClinicSettings, { role: 'ClinicStaff' });
  h.features.features.update((f) => ({ ...f, publicPrices }));
  h.fixture.detectChanges();
  answer(h.backend, 'GET', '/dashboard/clinic', clinic);
  await h.settle();
  await h.settle();
  return h;
}

describe('ClinicSettings price switch', () => {
  it('is editable while the platform allows public prices', async () => {
    const h = await open(true);
    expect(h.fixture.componentInstance['form'].controls.showPrices.disabled).toBe(false);
    expect(h.el.textContent).not.toContain('locked by the platform');
  });

  it('is locked with a note when the platform turns publicPrices off, keeping its value', async () => {
    const h = await open(false);
    const control = h.fixture.componentInstance['form'].controls.showPrices;
    expect(control.disabled).toBe(true);
    expect(control.value).toBe(true);
    expect(h.el.textContent).toContain('locked by the platform');
  });
});
