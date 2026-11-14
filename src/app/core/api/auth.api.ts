import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { SKIP_AUTH, SKIP_ERROR_TOAST } from '../http/http-context';
import { AppLang, CurrentUser, TokenResponse } from './models';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  private readonly anonymous = () =>
    new HttpContext().set(SKIP_AUTH, true).set(SKIP_ERROR_TOAST, true);

  requestOtp(phone: string): Observable<void> {
    return this.http.post<void>(
      apiUrl('/auth/otp/request'),
      { phone },
      { context: this.anonymous() },
    );
  }

  verifyOtp(phone: string, code: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      apiUrl('/auth/otp/verify'),
      { phone, code },
      { context: this.anonymous() },
    );
  }

  refresh(refreshToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      apiUrl('/auth/refresh'),
      { refreshToken },
      { context: this.anonymous() },
    );
  }

  logout(refreshToken: string | null): Observable<void> {
    return this.http.post<void>(
      apiUrl('/auth/logout'),
      { refreshToken },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(apiUrl('/me'), {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  updateMe(body: { fullName?: string; preferredLanguage?: AppLang }): Observable<CurrentUser> {
    return this.http.put<CurrentUser>(apiUrl('/me'), body, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
