import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import en from '../../../../public/i18n/en.json';
import { provideTestTranslations } from '../../../testing/test-providers';
import { Doctor, Slot } from '../../core/api/models';
import { API_ROOT } from '../../core/config/api-url';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';
import { SlotCalendar } from './slot-calendar';

const doctor: Doctor = {
  id: 'd1',
  clinicId: 'c1',
  specialtyId: 'sp1',
  slug: 'dr-test',
  nameAr: 'دكتور اختبار',
  nameEn: 'Test Doctor',
  isPublished: true,
};

const slot: Slot = {
  id: 's1',
  doctorId: 'd1',
  startsAt: '2026-11-24T09:00:00.000Z',
  endsAt: '2026-11-24T09:30:00.000Z',
  status: 'Open',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SlotCalendar load retry', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    // Keep the real retry flow but make the delays instant.
    (SlotCalendar as unknown as { retryDelaysMs: number[] }).retryDelaysMs = [1, 1, 1, 1];
    await TestBed.configureTestingModule({
      imports: [SlotCalendar],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const slotsRequest = () =>
    backend.expectOne((r) => r.url.includes('/dashboard/doctors/d1/slots'));

  async function setup() {
    const fixture = TestBed.createComponent(SlotCalendar);
    fixture.detectChanges();
    backend.expectOne(`${API_ROOT}/dashboard/doctors`).flush([doctor]);
    await fixture.whenStable();
    fixture.detectChanges();
    backend.expectOne(`${API_ROOT}/dashboard/doctors/d1/services`).flush([]);
    await fixture.whenStable();
    return fixture;
  }

  it('retries a 503 and shows the slots when a later attempt succeeds', async () => {
    const fixture = await setup();
    const first = slotsRequest();
    expect(first.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    first.flush({ code: 'UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    const cmp = fixture.componentInstance as unknown as {
      retrying: () => boolean;
      slots: () => Slot[];
      loadError: () => boolean;
    };
    expect(cmp.retrying()).toBe(true);
    expect(cmp.loadError()).toBe(false);

    await wait(30);
    fixture.detectChanges();
    slotsRequest().flush([slot]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cmp.retrying()).toBe(false);
    expect(cmp.loadError()).toBe(false);
    expect(cmp.slots().length).toBe(1);
    fixture.destroy();
  });

  it('shows the error immediately on 404, suppresses the toast, and does not retry', async () => {
    const fixture = await setup();
    const first = slotsRequest();
    expect(first.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    first.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    const cmp = fixture.componentInstance as unknown as {
      loading: () => boolean;
      retrying: () => boolean;
      loadError: () => boolean;
    };
    expect(cmp.loadError()).toBe(true);
    expect(cmp.loading()).toBe(false);
    expect(cmp.retrying()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(en.slots.loadError);

    await wait(30);
    backend.expectNone((r) => r.url.includes('/slots'));
    fixture.destroy();
  });
});
