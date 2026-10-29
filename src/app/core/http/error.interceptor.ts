import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_ROOT } from '../config/api-url';
import { SKIP_ERROR_TOAST } from './http-context';
import { ToastService } from './toast.service';

/**
 * Turns failed API calls into a localized toast keyed by the problem `code`.
 * Registered before the auth interceptor so it sees the outcome after any token refresh.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        req.url.startsWith(API_ROOT) &&
        !req.context.get(SKIP_ERROR_TOAST)
      ) {
        toast.error(error);
      }
      return throwError(() => error);
    }),
  );
};
