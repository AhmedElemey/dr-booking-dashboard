import { answer, internals, setupPage } from '../../../testing/phase2';
import { Holidays } from './holidays';

const holiday = (id: string, date: string, source = 'Manual') => ({
  id,
  clinicId: 'c1',
  date,
  nameAr: 'عيد',
  nameEn: 'Feast',
  source,
});

describe('Holidays', () => {
  async function open() {
    const h = setupPage(Holidays);
    h.fixture.detectChanges();
    const list = h.backend.expectOne((r) => r.url.endsWith('/dashboard/holidays'));
    expect(list.request.params.get('year')).toBe('2026');
    list.flush([holiday('h2', '2026-12-25'), holiday('h1', '2026-01-07', 'EgyptPublic')]);
    await h.settle();
    return h;
  }

  it('lists the year sorted by date', async () => {
    const { el } = await open();
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Feast');
    expect(rows[0].textContent).toContain('Jan');
  });

  it('keeps the form from submitting while it is invalid', async () => {
    const h = await open();
    internals(h.fixture)['add']();
    h.backend.expectNone((r) => r.method === 'POST');
  });

  it('adds a holiday and warns about booked appointments', async () => {
    const h = await open();
    internals(h.fixture)['form'].setValue({ date: '2026-12-30', nameAr: 'ا', nameEn: 'A' });
    internals(h.fixture)['add']();
    const post = h.backend.expectOne((r) => r.method === 'POST');
    expect(post.request.body).toMatchObject({ date: '2026-12-30', nameAr: 'ا', nameEn: 'A' });
    post.flush(holiday('h3', '2026-12-30'));
    h.backend
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/dashboard/holidays'))
      .flush([]);
    answer(h.backend, 'GET', '/dashboard/holidays/h3/conflicts', [
      {
        id: 'a1',
        startsAt: '2026-12-30T08:00:00Z',
        timezone: 'Africa/Cairo',
        patient: { fullName: 'Ali', phone: '+2010' },
        doctor: { name: 'Dr X' },
      },
    ]);
    await h.settle();
    expect(h.el.querySelector('.warning-box')?.textContent).toContain('Ali');
  });

  it('deletes after confirmation', async () => {
    const h = await open();
    internals(h.fixture)['remove'](holiday('h1', '2026-01-07'));
    answer(h.backend, 'DELETE', '/dashboard/holidays/h1', null);
    h.backend
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/dashboard/holidays'))
      .flush([]);
    expect(h.snackOpen).toHaveBeenCalled();
  });

  it('does not delete when the dialog is dismissed', async () => {
    const h = setupPage(Holidays, { dialogResults: [false] });
    h.fixture.detectChanges();
    h.backend.expectOne((r) => r.url.endsWith('/dashboard/holidays')).flush([]);
    internals(h.fixture)['remove'](holiday('h1', '2026-01-07'));
    h.backend.expectNone((r) => r.method === 'DELETE');
  });

  it('imports the Egyptian holidays for the shown year', async () => {
    const h = await open();
    internals(h.fixture)['importEgypt']();
    const post = answer(h.backend, 'POST', '/dashboard/holidays/import-egypt', {
      created: 9,
      skipped: 1,
    });
    expect(post.request.body.year).toBe(2026);
    h.backend
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/dashboard/holidays'))
      .flush([]);
  });

  it('moves to another year', async () => {
    const h = await open();
    internals(h.fixture)['shiftYear'](1);
    const req = h.backend.expectOne((r) => r.method === 'GET');
    expect(req.request.params.get('year')).toBe('2027');
    req.flush([]);
    await h.settle();
    expect(h.el.querySelector('.empty-state')).not.toBeNull();
  });

  it('shows Arabic names in Arabic', async () => {
    const h = setupPage(Holidays, { lang: 'ar' });
    h.fixture.detectChanges();
    h.backend
      .expectOne((r) => r.url.endsWith('/dashboard/holidays'))
      .flush([holiday('h', '2026-12-25')]);
    await h.settle();
    expect(h.el.querySelector('tbody')?.textContent).toContain('عيد');
  });
});
