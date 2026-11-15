import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, isObservable, Observable } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { API_ROOT } from './api-url';
import { featureGuard } from './feature.guard';
import { FeaturesService } from './features.service';

describe('featureGuard', () => {
  const role = signal<'ClinicStaff' | 'PlatformAdmin'>('ClinicStaff');

  beforeEach(() => {
    localStorage.clear();
    role.set('ClinicStaff');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { role } },
      ],
    });
  });

  const run = async (feature: Parameters<typeof featureGuard>[0]) => {
    const result = TestBed.runInInjectionContext(() =>
      featureGuard(feature)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return isObservable(result)
      ? await firstValueFrom(result as Observable<boolean | UrlTree>)
      : await result;
  };

  it('lets the route through while the feature is on', async () => {
    TestBed.inject(FeaturesService).features.update((f) => ({ ...f, holidayCalendar: true }));
    expect(await run('holidayCalendar')).toBe(true);
  });

  it('sends the user home while the feature is off', async () => {
    TestBed.inject(FeaturesService).features.update((f) => ({ ...f, holidayCalendar: false }));
    const result = (await run('holidayCalendar')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/agenda');
  });

  it('sends a platform admin to the admin home', async () => {
    role.set('PlatformAdmin');
    TestBed.inject(FeaturesService).features.update((f) => ({ ...f, promotions: false }));
    const result = (await run('promotions')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/admin/clinics');
  });

  it('waits for the first GET /features before deciding on a deep link', async () => {
    const features = TestBed.inject(FeaturesService);
    features.start();
    await new Promise((r) => setTimeout(r, 10));
    const pending = run('reports');
    let done = false;
    void pending.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_ROOT}/features`)
      .flush({ features: { reports: true } });
    expect(await pending).toBe(true);
    expect(features.settled()).toBe(true);
  });

  it('settles when GET /features fails, keeping the cached switches', async () => {
    const features = TestBed.inject(FeaturesService);
    features.start();
    await new Promise((r) => setTimeout(r, 10));
    const pending = run('reports');
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_ROOT}/features`)
      .flush('x', { status: 500, statusText: 'err' });
    await pending;
    expect(features.settled()).toBe(true);
  });
});
