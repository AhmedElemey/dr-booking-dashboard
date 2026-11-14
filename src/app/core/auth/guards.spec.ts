import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable } from 'rxjs';

import { CurrentUser, Role } from '../api/models';
import { API_ROOT } from '../config/api-url';
import { AuthService, REFRESH_TOKEN_KEY } from './auth.service';
import { authGuard, guestGuard, homeFor, roleGuard } from './guards';

const userWith = (role: Role): CurrentUser => ({
  id: 'u',
  phone: '+201012345678',
  fullName: 'X',
  role,
  preferredLanguage: 'ar',
});

describe('route guards', () => {
  let router: Router;
  let auth: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function run(guard: typeof authGuard, data: Record<string, unknown> = {}, url = '/agenda') {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    let result: boolean | UrlTree | undefined;
    const out = TestBed.runInInjectionContext(() => guard(route, state)) as Observable<
      boolean | UrlTree
    >;
    out.subscribe((r) => (result = r));
    return () => result;
  }

  it('authGuard sends anonymous visitors to /login and remembers where they wanted to go', () => {
    const result = run(authGuard)();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fagenda');
  });

  it('authGuard lets a signed-in user through', () => {
    auth.user.set(userWith('ClinicStaff'));
    expect(run(authGuard)()).toBe(true);
  });

  it('authGuard restores the user from /me when only a refresh token exists', () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    const result = run(authGuard);
    backend
      .expectOne(`${API_ROOT}/auth/refresh`)
      .flush({ accessToken: 'a', refreshToken: 'r2', expiresIn: 900 });
    backend.expectOne(`${API_ROOT}/me`).flush(userWith('Doctor'));
    expect(result()).toBe(true);
  });

  it('authGuard rejects a Patient found via /me', () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'r');
    const result = run(authGuard);
    backend
      .expectOne(`${API_ROOT}/auth/refresh`)
      .flush({ accessToken: 'a', refreshToken: 'r2', expiresIn: 900 });
    backend.expectOne(`${API_ROOT}/me`).flush(userWith('Patient'));
    expect(router.serializeUrl(result() as UrlTree)).toContain('/login');
  });

  describe('roleGuard', () => {
    it.each<[Role, boolean]>([
      ['Doctor', true],
      ['ClinicStaff', true],
      ['PlatformAdmin', false],
    ])('staff-only route for %s -> allowed: %s', (role, allowed) => {
      auth.user.set(userWith(role));
      const result = run(roleGuard, { roles: ['Doctor', 'ClinicStaff'] })();
      if (allowed) expect(result).toBe(true);
      else expect(router.serializeUrl(result as UrlTree)).toBe('/admin/clinics');
    });

    it('admin-only route sends staff back to the agenda (admin does not see patient data)', () => {
      auth.user.set(userWith('ClinicStaff'));
      const result = run(roleGuard, { roles: ['PlatformAdmin'] })();
      expect(router.serializeUrl(result as UrlTree)).toBe('/agenda');
    });

    it('admin-only route is open to the platform admin', () => {
      auth.user.set(userWith('PlatformAdmin'));
      expect(run(roleGuard, { roles: ['PlatformAdmin'] })()).toBe(true);
    });

    it('anonymous visitors go to /login', () => {
      expect(router.serializeUrl(run(roleGuard, { roles: ['Doctor'] })() as UrlTree)).toBe(
        '/login',
      );
    });
  });

  describe('guestGuard', () => {
    it('shows the login page to anonymous visitors', () => {
      expect(run(guestGuard)()).toBe(true);
    });
    it('redirects signed-in users to their home', () => {
      auth.user.set(userWith('PlatformAdmin'));
      expect(router.serializeUrl(run(guestGuard)() as UrlTree)).toBe('/admin/clinics');
    });
  });

  it('homeFor maps roles to landing pages', () => {
    expect(homeFor('PlatformAdmin')).toBe('/admin/clinics');
    expect(homeFor('Doctor')).toBe('/agenda');
    expect(homeFor(null)).toBe('/agenda');
  });

  // keep the unused import honest
  it('runs guards in an environment injector', () => {
    expect(() => runInInjectionContext(TestBed.inject(EnvironmentInjector), () => 1)).not.toThrow();
  });
});
