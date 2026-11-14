import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { API_ROOT } from '../config/api-url';
import { REFRESH_TOKEN_KEY, AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresIn: 900,
});

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate, url: '/agenda' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.accessToken.set('access-0');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-0');
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token to API calls', () => {
    http.get(`${API_ROOT}/me`).subscribe();
    const req = backend.expectOne(`${API_ROOT}/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-0');
    req.flush({});
  });

  it('does not send the token to other origins', () => {
    http.get('https://example.com/data').subscribe();
    const req = backend.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('refreshes once on 401, stores the rotated tokens and replays the request', () => {
    let result: unknown;
    http.get(`${API_ROOT}/dashboard/clinic`).subscribe((r) => (result = r));

    backend
      .expectOne(`${API_ROOT}/dashboard/clinic`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${API_ROOT}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-0' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(tokens(1));

    const retry = backend.expectOne(`${API_ROOT}/dashboard/clinic`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-1');
    retry.flush({ id: 'c1' });

    expect(result).toEqual({ id: 'c1' });
    expect(auth.accessToken()).toBe('access-1');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('shares one refresh between simultaneous 401s (refresh tokens rotate, so a second call would burn the family)', () => {
    const done: unknown[] = [];
    http.get(`${API_ROOT}/a`).subscribe((r) => done.push(r));
    http.get(`${API_ROOT}/b`).subscribe((r) => done.push(r));

    backend.expectOne(`${API_ROOT}/a`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API_ROOT}/b`).flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne(`${API_ROOT}/auth/refresh`).flush(tokens(1)); // exactly one refresh call
    backend.expectOne(`${API_ROOT}/a`).flush('a');
    backend.expectOne(`${API_ROOT}/b`).flush('b');

    expect(done.sort()).toEqual(['a', 'b']);
  });

  it('signs the user out and goes to /login when the refresh fails', () => {
    let error: { status: number } | undefined;
    http.get(`${API_ROOT}/me`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${API_ROOT}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${API_ROOT}/auth/refresh`)
      .flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    expect(error?.status).toBe(401);
    expect(auth.accessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/agenda' } });
  });

  it('does not loop: a 401 on the replayed request is surfaced', () => {
    let error: { status: number } | undefined;
    http.get(`${API_ROOT}/me`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${API_ROOT}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API_ROOT}/auth/refresh`).flush(tokens(1));
    backend.expectOne(`${API_ROOT}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(error?.status).toBe(401);
    backend.expectNone(`${API_ROOT}/auth/refresh`);
  });

  it('passes non-401 errors through without refreshing', () => {
    let error: { status: number } | undefined;
    http.get(`${API_ROOT}/me`).subscribe({ error: (e) => (error = e) });
    backend
      .expectOne(`${API_ROOT}/me`)
      .flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    expect(error?.status).toBe(403);
    backend.expectNone(`${API_ROOT}/auth/refresh`);
  });

  it('goes to /login on 401 when there is no refresh token to try', () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    http.get(`${API_ROOT}/me`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_ROOT}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).toHaveBeenCalled();
    backend.expectNone(`${API_ROOT}/auth/refresh`);
  });
});
