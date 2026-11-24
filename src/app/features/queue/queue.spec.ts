import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFixedClock, provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../../core/config/api-url';
import { Queue } from './queue';

const entry = (
  id: string,
  status: string,
  position: number,
  patient = 'Mona',
  doctorId = 'd1',
) => ({
  appointment: {
    id,
    status,
    slotId: `slot-${id}`,
    startsAt: '2026-11-24T10:00:00Z',
    endsAt: '2026-11-24T10:30:00Z',
    timezone: 'Africa/Cairo',
    doctor: { id: doctorId, name: 'Dr. Amr Hassan' },
    patient: { id: `pt-${id}`, fullName: patient, phone: '+201000000021' },
    checkedInAt: status === 'Confirmed' ? null : '2026-11-24T09:50:00Z',
    startedAt: status === 'InProgress' ? '2026-11-24T09:55:00Z' : null,
  },
  position,
});

describe('Queue', () => {
  const setup = async () => {
    TestBed.configureTestingModule({
      imports: [Queue],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        provideFixedClock('2026-11-24T12:00:00'),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Queue);
    fixture.detectChanges();
    backend.expectOne(`${API_ROOT}/dashboard/doctors`).flush([]);
    const req = backend.expectOne(`${API_ROOT}/dashboard/appointments/queue`);
    return { backend, fixture, req };
  };

  it('lists today\'s queue with positions and status chips', async () => {
    const { backend, fixture, req } = await setup();
    req.flush([entry('a1', 'InProgress', 1, 'Ali'), entry('a2', 'CheckedIn', 2, 'Mona')]);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ali');
    expect(text).toContain('Mona');
    expect(text).toContain('With the doctor');
    expect(text).toContain('Checked in');
    backend.verify();
  });

  it('checks a patient in and reloads the queue', async () => {
    const { backend, fixture, req } = await setup();
    req.flush([entry('a1', 'Confirmed', 1)]);
    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('tbody button');
    expect(button.textContent).toContain('Check in');
    button.click();
    await fixture.whenStable();

    const action = backend.expectOne(`${API_ROOT}/dashboard/appointments/a1/check-in`);
    expect(action.request.method).toBe('POST');
    action.flush({ ...entry('a1', 'CheckedIn', 1).appointment, status: 'CheckedIn' });
    backend.expectOne(`${API_ROOT}/dashboard/appointments/queue`).flush([]);
    await fixture.whenStable();
    backend.verify();
  });

  it('starts a checked-in visit and completes a visit with the doctor', async () => {
    const { backend, fixture, req } = await setup();
    req.flush([entry('a1', 'CheckedIn', 1)]);
    await fixture.whenStable();
    fixture.detectChanges();

    const startButton: HTMLButtonElement = fixture.nativeElement.querySelector('tbody button');
    expect(startButton.textContent).toContain('Start');
    startButton.click();
    await fixture.whenStable();
    backend
      .expectOne(`${API_ROOT}/dashboard/appointments/a1/start`)
      .flush(entry('a1', 'InProgress', 1).appointment);
    backend
      .expectOne(`${API_ROOT}/dashboard/appointments/queue`)
      .flush([entry('a1', 'InProgress', 1)]);
    await fixture.whenStable();
    fixture.detectChanges();

    const completeButton: HTMLButtonElement = fixture.nativeElement.querySelector('tbody button');
    expect(completeButton.textContent).toContain('Complete');
    completeButton.click();
    await fixture.whenStable();
    backend
      .expectOne(`${API_ROOT}/dashboard/appointments/a1/complete`)
      .flush({ ...entry('a1', 'Completed', 1).appointment, status: 'Completed' });
    backend.expectOne(`${API_ROOT}/dashboard/appointments/queue`).flush([]);
    await fixture.whenStable();
    backend.verify();
  });
});
