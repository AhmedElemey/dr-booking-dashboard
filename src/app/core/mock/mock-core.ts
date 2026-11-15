import { HttpRequest } from '@angular/common/http';

/** Shared bits of the fake backend (kept apart so the route modules do not import each other). */

export interface Ctx {
  req: HttpRequest<unknown>;
  params: string[];
  body: Record<string, unknown>;
  query: URLSearchParams;
  role: 'staff' | 'doctor' | 'admin';
}

/** A body plus response headers (the real API sends `X-Total-Count` on the patients list). */
export class WithHeaders {
  constructor(
    readonly body: unknown,
    readonly headers: Record<string, string>,
  ) {}
}

export type Handler = (ctx: Ctx) => unknown;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/** A 400 VALIDATION_FAILED carrying the API's per-field `errors{}`. */
export const validationError = (errors: Record<string, string[]>) =>
  new ApiError(400, 'VALIDATION_FAILED', { errors });

/** API path of a record's attachment (needs the bearer token, like the real endpoint). */
export const attachmentPath = (recordId: string) =>
  `/api/v1/dashboard/records/${recordId}/attachment`;

/** The demo doctor account (phone 01000000011) and the demo clinic's staff user. */
export const DOCTOR_ID = 'doc-sara';
export const DOCTOR_USER_ID = 'u-doc';
export const STAFF_USER_ID = 'u-staff';
