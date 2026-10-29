import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { AuthApi } from '../api/auth.api';
import { AppLang, CurrentUser, Role, TokenResponse } from '../api/models';

export const REFRESH_TOKEN_KEY = 'moonlight.refreshToken';

/** Thrown by `verifyOtp` when a Patient account signs in to the staff dashboard. */
export class RoleNotAllowedError extends Error {
  readonly code = 'ROLE_NOT_ALLOWED';
  constructor() {
    super('ROLE_NOT_ALLOWED');
  }
}

/**
 * Session state. The access token lives in memory only; the refresh token is kept in
 * `localStorage` (accepted MVP trade-off, spec section 4).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);

  readonly accessToken = signal<string | null>(null);
  readonly user = signal<CurrentUser | null>(null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  private refreshInFlight$: Observable<string> | null = null;

  // ---- refresh-token persistence (localStorage may be unavailable) ----

  get refreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private storeRefreshToken(token: string | null): void {
    try {
      if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
      else localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Storage blocked: the session just will not survive a reload.
    }
  }

  private storeTokens(res: TokenResponse): void {
    this.accessToken.set(res.accessToken);
    this.storeRefreshToken(res.refreshToken);
  }

  // ---- login ----

  requestOtp(phone: string): Observable<void> {
    return this.api.requestOtp(phone);
  }

  verifyOtp(phone: string, code: string): Observable<CurrentUser> {
    return this.api.verifyOtp(phone, code).pipe(
      tap((res) => this.storeTokens(res)),
      switchMap((res) => (res.user ? of(res.user) : this.api.me())),
      tap((user) => {
        if (user.role === 'Patient') {
          this.clearSession();
          throw new RoleNotAllowedError();
        }
        this.user.set(user);
      }),
    );
  }

  // ---- tokens ----

  hasRefreshToken(): boolean {
    return this.refreshToken !== null;
  }

  /** Exchanges the refresh token for a new pair. Concurrent callers share one request. */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight$) return this.refreshInFlight$;
    const token = this.refreshToken;
    if (!token) return throwError(() => new Error('NO_REFRESH_TOKEN'));

    this.refreshInFlight$ = this.api.refresh(token).pipe(
      tap((res) => this.storeTokens(res)),
      map((res) => res.accessToken),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  /**
   * Resolves the current user, restoring the session from the refresh token after a page
   * reload. Emits `null` when nobody is signed in.
   */
  loadUser(): Observable<CurrentUser | null> {
    const current = this.user();
    if (current) return of(current);
    if (!this.accessToken() && !this.hasRefreshToken()) return of(null);

    const ensureToken$ = this.accessToken() ? of(this.accessToken()!) : this.refreshAccessToken();
    return ensureToken$.pipe(
      switchMap(() => this.api.me()),
      tap((user) => {
        if (user.role === 'Patient') throw new RoleNotAllowedError();
        this.user.set(user);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  /** Best effort: remembers the UI language on the server profile. */
  savePreferredLanguage(language: AppLang): void {
    const user = this.user();
    if (!user || user.preferredLanguage === language) return;
    this.user.set({ ...user, preferredLanguage: language });
    this.api.updateMe({ preferredLanguage: language }).subscribe({ error: () => undefined });
  }

  // ---- logout ----

  logout(): Observable<void> {
    const request$ = this.accessToken() ? this.api.logout() : of(undefined);
    return request$.pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      finalize(() => {
        this.clearSession();
        void this.router.navigate(['/login']);
      }),
    );
  }

  /** Called when the session can no longer be recovered (refresh failed). */
  expireSession(): void {
    this.clearSession();
    if (!this.router.url.startsWith('/login')) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
    }
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
    this.refreshInFlight$ = null;
    this.storeRefreshToken(null);
  }
}
