import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiUrl } from './api-url';
import { BRAND } from './brand';
import {
  FEATURES_CACHE_KEY,
  FEATURES_REFRESH_MS,
  FeaturesService,
  mergeFeatures,
} from './features.service';

describe('FeaturesService', () => {
  let backend: HttpTestingController;

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    return TestBed.inject(FeaturesService);
  };
  const answer = (features: object) =>
    backend
      .expectOne(apiUrl('/features'))
      .flush({ features, source: 'console', updatedAt: '2026-11-14T17:00:00Z' });

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('starts from the config defaults', () => {
    const service = setup();
    expect(service.features()).toEqual(BRAND.features);
  });

  it('starts from the cached value when there is one', () => {
    localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify({ englishLanguage: false }));
    const service = setup();
    expect(service.englishLanguage()).toBe(false);
    expect(service.multiBranch()).toBe(BRAND.features.multiBranch);
  });

  it('ignores a corrupt cache', () => {
    localStorage.setItem(FEATURES_CACHE_KEY, '{nope');
    expect(setup().features()).toEqual(BRAND.features);
  });

  it('applies and caches what the backend reports', async () => {
    const service = setup();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    answer({ ...BRAND.features, multiBranch: false, englishLanguage: false });
    expect(service.multiBranch()).toBe(false);
    expect(service.englishLanguage()).toBe(false);
    expect(JSON.parse(localStorage.getItem(FEATURES_CACHE_KEY)!)).toMatchObject({
      multiBranch: false,
    });
  });

  it('refreshes every five minutes', async () => {
    const service = setup();
    service.start();
    service.start(); // idempotent
    await vi.advanceTimersByTimeAsync(0);
    answer({ multiBranch: false });
    await vi.advanceTimersByTimeAsync(FEATURES_REFRESH_MS - 1);
    backend.expectNone(apiUrl('/features'));
    await vi.advanceTimersByTimeAsync(1);
    answer({ multiBranch: true });
    expect(service.multiBranch()).toBe(true);
  });

  it('keeps the last known value when the backend is unreachable', async () => {
    localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify({ multiBranch: false }));
    const service = setup();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    backend.expectOne(apiUrl('/features')).flush('x', { status: 503, statusText: 'down' });
    expect(service.multiBranch()).toBe(false);
  });

  it('fills missing keys with defaults and ignores unknown or non-boolean ones', () => {
    const merged = mergeFeatures({ multiBranch: false, mystery: true, website: 'yes' });
    expect(merged).toEqual({ ...BRAND.features, multiBranch: false });
    expect(Object.keys(merged)).not.toContain('mystery');
  });

  it('turns a feature off and raises the notice when the API reports it disabled', () => {
    const service = setup();
    service.reportDisabled('multiBranch');
    expect(service.multiBranch()).toBe(false);
    expect(service.disabledNotice()).toBe('multiBranch');
    service.dismissNotice();
    expect(service.disabledNotice()).toBeNull();
    service.reportDisabled('bogus');
    expect(service.disabledNotice()).toBeNull();
  });

  it('exposes patientSelfService without any dashboard effect', () => {
    const service = setup();
    service.features.update((f) => ({ ...f, patientSelfService: false }));
    expect(service.patientSelfService()).toBe(false);
  });
});
