import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_ROOT } from '../config/api-url';
import { RETRIED, SKIP_AUTH } from '../http/http-context';
import { AuthService } from './auth.service';

const withBearer = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Attaches the access token and, on a 401, refreshes it once and replays the request.
 * If the refresh fails the session is dropped and the user is sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_ROOT) || req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();

  return next(token ? withBearer(req, token) : req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      if (req.context.get(RETRIED) || !auth.hasRefreshToken()) {
        auth.expireSession();
        return throwError(() => error);
      }
      return auth.refreshAccessToken().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => error);
        }),
        switchMap((fresh) =>
          next(withBearer(req.clone({ context: req.context.set(RETRIED, true) }), fresh)),
        ),
      );
    }),
  );
};
