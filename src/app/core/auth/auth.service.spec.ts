import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { CurrentUser } from '../api/models';
import { API_ROOT } from '../config/api-url';
import { AuthService, REFRESH_TOKEN_KEY, RoleNotAllowedError } from './auth.service';

const staff: CurrentUser = {
  id: 'u1',
  phone: '+201012345678',
  fullName: 'Mona',
  role: 'ClinicStaff',
  preferredLanguage: 'ar',
  clinicId: 'c1',
};

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true), url: '/' } },
      ],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('keeps the access token in memory and the refresh token in localStorage after login', () => {
    let user: CurrentUser | undefined;
    auth.verifyOtp('+201012345678', '123456').subscribe((u) => (user = u));
    const req = backend.expectOne(`${API_ROOT}/auth/otp/verify`);
    expect(req.request.body).toEqual({ phone: '+201012345678', code: '123456' });
    req.flush({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      isNewUser: false,
      user: staff,
    });

    expect(user).toEqual(staff);
    expect(auth.accessToken()).toBe('a');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r');
    expect(JSON.stringify(localStorage)).not.toContain('"a"');
    expect(auth.role()).toBe('ClinicStaff');
  });

  it('falls back to GET /me when the verify response has no user', () => {
    auth.verifyOtp('+201012345678', '123456').subscribe();
    backend
      .expectOne(`${API_ROOT}/auth/otp/verify`)
      .flush({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    backend.expectOne(`${API_ROOT}/me`).flush(staff);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('rejects Patient accounts and leaves no session behind', () => {
    let error: unknown;
    auth.verifyOtp('+201012345678', '123456').subscribe({ error: (e) => (error = e) });
    backend.expectOne(`${API_ROOT}/auth/otp/verify`).flush({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      user: { ...staff, role: 'Patient' },
    });
    expect(error).toBeInstanceOf(RoleNotAllowedError);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('restores the session after a reload from the refresh token', () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'stored');
    let user: CurrentUser | null | undefined;
    auth.loadUser().subscribe((u) => (user = u));

    const refresh = backend.expectOne(`${API_ROOT}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'stored' });
    refresh.flush({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 });
    backend.expectOne(`${API_ROOT}/me`).flush(staff);

    expect(user).toEqual(staff);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('r2');
  });

  it('emits null without any request when nobody is signed in', () => {
    let user: CurrentUser | null | undefined;
    auth.loadUser().subscribe((u) => (user = u));
    expect(user).toBeNull();
    backend.expectNone(() => true);
  });

  it('clears the session if the stored refresh token is rejected', () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'dead');
    let user: CurrentUser | null | undefined;
    auth.loadUser().subscribe((u) => (user = u));
    backend
      .expectOne(`${API_ROOT}/auth/refresh`)
      .flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'x' });
    expect(user).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('logout revokes server-side and clears local state even if the call fails', () => {
    auth.accessToken.set('a');
    auth.user.set(staff);
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    auth.logout().subscribe();
    backend.expectOne(`${API_ROOT}/auth/logout`).flush(null, { status: 500, statusText: 'err' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('still works when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(auth.refreshToken).toBeNull();
    spy.mockRestore();
  });
});
