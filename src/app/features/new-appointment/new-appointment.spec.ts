import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { Doctor, Slot } from '../../core/api/models';
import { API_ROOT } from '../../core/config/api-url';
import { NewAppointment } from './new-appointment';

const doctor: Doctor = {
  id: 'd1',
  clinicId: 'c1',
  specialtyId: 's1',
  slug: 'amr-hassan',
  nameAr: 'د. عمرو حسن',
  nameEn: 'Dr. Amr Hassan',
  isPublished: true,
  offersVideo: false,
};

const slot = (id: string, startsAt: string): Slot => ({
  id,
  doctorId: 'd1',
  startsAt,
  endsAt: startsAt,
  status: 'Open',
});

describe('NewAppointment', () => {
  it('hides slots whose start time has already passed, like the public site', async () => {
    TestBed.configureTestingModule({
      imports: [NewAppointment],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        // 12:30 in Cairo on 2026-11-24.
        provideFixedClock('2026-11-24T12:30:00'),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(NewAppointment);
    fixture.detectChanges();

    backend.expectOne(`${API_ROOT}/dashboard/doctors`).flush([doctor]);
    await fixture.whenStable();
    fixture.detectChanges();

    const slotsReq = backend.expectOne((r) => r.url === `${API_ROOT}/dashboard/doctors/d1/slots`);
    expect(slotsReq.request.params.get('from')).toBe('2026-11-24');
    slotsReq.flush([
      slot('past-morning', '2026-11-24T08:00:00Z'), // 10:00 Cairo, gone
      slot('past-noon', '2026-11-24T10:30:00Z'), // 12:30 Cairo, starting now
      slot('future-today', '2026-11-24T11:00:00Z'), // 13:00 Cairo
      slot('future-tomorrow', '2026-11-25T08:00:00Z'),
    ]);
    backend.expectOne(`${API_ROOT}/dashboard/doctors/d1/services`).flush([]);
    await fixture.whenStable();

    const shown = fixture.componentInstance['openSlots']().map((s: Slot) => s.id);
    expect(shown).toEqual(['future-today', 'future-tomorrow']);
  });
});
