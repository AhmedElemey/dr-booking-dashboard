import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import en from '../../../../public/i18n/en.json';
import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../../core/config/api-url';
import { BulkDialog } from './bulk-dialog';

describe('BulkDialog', () => {
  let backend: HttpTestingController;

  async function setup() {
    TestBed.configureTestingModule({
      imports: [BulkDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        provideFixedClock('2026-11-02T08:00:00'),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { doctorId: 'd1', startDate: '2026-11-02', services: [] },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BulkDialog);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const addButton = () =>
      [...el.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')].find((b) =>
        b.textContent!.includes(en.bulk.addAction),
      )!;
    return { fixture, el, addButton };
  }

  it('shows the slot count preview before saving', async () => {
    const { el } = await setup();
    // 28 days from Mon 2 Nov, Sat-Thu selected (24 days), 10 slots/day.
    expect(el.textContent).toContain('Up to 240 slots on 24 days will be created.');
  });

  it('refuses to submit an invalid form and lists the problems', async () => {
    const { fixture, el, addButton } = await setup();
    const instance = fixture.componentInstance as unknown as {
      days: { set(v: number[]): void };
      endTime: { set(v: string): void };
    };
    instance.days.set([]);
    instance.endTime.set('08:00');
    fixture.detectChanges();

    addButton().click();
    fixture.detectChanges();

    backend.expectNone(`${API_ROOT}/doctors/d1/slots/bulk`);
    expect(el.querySelector('.issues')?.textContent).toContain(en.bulk.error.noDays);
    expect(el.querySelector('.issues')?.textContent).toContain(en.bulk.error.times);
  });

  it('posts the repeat-helper request and reports created and skipped counts', async () => {
    const { fixture, el, addButton } = await setup();
    addButton().click();

    const req = backend.expectOne(`${API_ROOT}/dashboard/doctors/d1/slots/bulk`);
    expect(req.request.body).toEqual({
      fromDate: '2026-11-02',
      toDate: '2026-11-29',
      daysOfWeek: [0, 1, 2, 3, 4, 6],
      startTime: '09:00',
      endTime: '14:00',
      slotMinutes: 30,
    });
    req.flush({ created: 230, skipped: 10 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('230 slots created');
    expect(el.textContent).toContain('10 skipped');
  });
});
