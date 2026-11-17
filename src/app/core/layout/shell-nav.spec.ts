import { internals, setupPage } from '../../../testing/phase2';
import { PHASE2_FEATURE_KEYS } from '../config/brand';
import { AuthService } from '../auth/auth.service';
import { Shell } from './shell';

describe('Shell navigation (phase 2)', () => {
  const user = (role: string) => ({
    id: 'u',
    phone: '+20',
    fullName: 'U',
    role,
    preferredLanguage: 'en',
    clinicId: 'c1',
  });
  const links = (role: string, on: string[] = []) => {
    const h = setupPage(Shell, { features: on });
    TestBed_auth(h).user.set(user(role) as never);
    return (internals(h.fixture)['nav']() as { link: string }[]).map((i) => i.link);
  };
  const TestBed_auth = (h: ReturnType<typeof setupPage>) =>
    (h.fixture.componentInstance as unknown as { auth: AuthService }).auth;

  it('hides every phase 2 page while the features are off', () => {
    const l = links('ClinicStaff');
    for (const path of [
      '/holidays',
      '/working-hours',
      '/waiting-list',
      '/payments',
      '/insurance',
      '/patients',
      '/reviews',
      '/coupons',
      '/recall',
      '/reports',
      '/messages',
    ]) {
      expect(l).not.toContain(path);
    }
    expect(l).toContain('/agenda');
  });

  it('shows them for clinic staff when all are on', () => {
    const l = links('ClinicStaff', [...PHASE2_FEATURE_KEYS]);
    for (const path of [
      '/holidays',
      '/working-hours',
      '/waiting-list',
      '/payments',
      '/insurance',
      '/patients',
      '/reviews',
      '/coupons',
      '/recall',
      '/reports',
      '/messages',
    ]) {
      expect(l).toContain(path);
    }
  });

  it('keeps clinic-only pages away from doctors', () => {
    const l = links('Doctor', [...PHASE2_FEATURE_KEYS]);
    expect(l).toContain('/patients');
    expect(l).toContain('/reports');
    for (const path of ['/holidays', '/coupons', '/recall', '/working-hours']) {
      expect(l).not.toContain(path);
    }
  });

  it('turns a single page on with its own switch only', () => {
    const l = links('ClinicStaff', ['holidayCalendar']);
    expect(l).toContain('/holidays');
    expect(l).not.toContain('/coupons');
  });

  const groups = (role: string, on: string[] = []) => {
    const h = setupPage(Shell, { features: on });
    TestBed_auth(h).user.set(user(role) as never);
    return internals(h.fixture)['navGroups']() as { group: string; items: { link: string }[] }[];
  };

  it('groups the menu under ordered headers', () => {
    const all = groups('ClinicStaff', [...PHASE2_FEATURE_KEYS]);
    expect(all.map((g) => g.group)).toEqual([
      'today',
      'patients',
      'schedule',
      'money',
      'growth',
      'settings',
    ]);
    expect(all[0].items.map((i) => i.link)).toEqual([
      '/agenda',
      '/appointments/new',
      '/waiting-list',
    ]);
  });

  it('hides a group header when it has no visible items', () => {
    const bare = groups('ClinicStaff');
    expect(bare.map((g) => g.group)).toEqual(['today', 'schedule', 'settings']);
  });
});
