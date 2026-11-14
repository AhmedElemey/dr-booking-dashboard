import { HttpErrorResponse } from '@angular/common/http';

import { ProblemDetails } from '../api/models';

/** Error codes the UI has a localized message for (keys under `errors.*`). */
export const KNOWN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'SLOT_UNAVAILABLE',
  'SLOT_RESERVED',
  'SLOT_OVERLAP',
  'INVALID_TRANSITION',
  'CANCEL_WINDOW_PASSED',
  'PHONE_IN_USE',
  'BOOKING_LIMIT',
  'RATE_LIMITED',
  'FEATURE_DISABLED',
  'INTERNAL_ERROR',
] as const;

export function problemOf(error: unknown): ProblemDetails | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return error.error as ProblemDetails;
  }
  return null;
}

/** Stable machine code for an HTTP failure: the API's `code`, or one derived from the status. */
export function errorCode(error: unknown): string {
  const problem = problemOf(error);
  if (problem?.code) return problem.code;
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'NETWORK';
    if (error.status === 401) return 'UNAUTHORIZED';
    if (error.status === 403) return 'FORBIDDEN';
    if (error.status === 404) return 'NOT_FOUND';
    if (error.status === 429) return 'RATE_LIMITED';
    if (error.status >= 500) return 'INTERNAL_ERROR';
  }
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return 'UNKNOWN';
}

/** Translation key for an error code, falling back to a generic message. */
export function errorMessageKey(code: string): string {
  const known = (KNOWN_ERROR_CODES as readonly string[]).includes(code);
  return known || code === 'NETWORK' || code === 'ROLE_NOT_ALLOWED'
    ? `errors.${code}`
    : 'errors.UNKNOWN';
}
