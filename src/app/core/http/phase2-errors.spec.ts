import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../config/api-url';
import {
  COUPON_REASONS,
  KNOWN_ERROR_CODES,
  couponReasonKey,
  validationMessages,
} from './error-codes';
import { errorInterceptor } from './error.interceptor';

const NEW_CODES = [
  'CLINIC_CLOSED',
  'COUPON_INVALID',
  'ALREADY_REVIEWED',
  'NOT_REVIEWABLE',
  'PAYMENT_NOT_ALLOWED',
  'VIDEO_NOT_OPEN',
  'ALREADY_WAITING',
  'PROVIDER_ERROR',
];

describe('phase 2 error codes', () => {
  let open: ReturnType<typeof vi.fn>;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  const fail = (body: object, status = 400) => {
    http.get(`${API_ROOT}/x`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_ROOT}/x`).flush(body, { status, statusText: 'err' });
  };

  it.each(NEW_CODES)('knows %s and has both translations', (code) => {
    expect(KNOWN_ERROR_CODES).toContain(code);
    expect((en.errors as Record<string, string>)[code]).toBeTruthy();
    expect((ar.errors as Record<string, string>)[code]).toBeTruthy();
  });

  it('shows the specific reason of COUPON_INVALID', () => {
    fail({ status: 400, code: 'COUPON_INVALID', reason: 'Expired' });
    expect(open.mock.calls[0][0]).toBe(en.couponReason.Expired);
  });

  it('shows the Arabic reason when the UI is Arabic', () => {
    TestBed.inject(TranslateService).use('ar');
    fail({ status: 400, code: 'COUPON_INVALID', reason: 'Exhausted' });
    expect(open.mock.calls[0][0]).toBe(ar.couponReason.Exhausted);
  });

  it('falls back to the generic coupon message for an unknown reason', () => {
    fail({ status: 400, code: 'COUPON_INVALID', reason: 'Whatever' });
    expect(open.mock.calls[0][0]).toBe(en.errors.COUPON_INVALID);
  });

  it('maps CLINIC_CLOSED to its message', () => {
    fail({ status: 409, code: 'CLINIC_CLOSED' }, 409);
    expect(open.mock.calls[0][0]).toBe(en.errors.CLINIC_CLOSED);
  });

  it('appends the API field messages to a validation failure', () => {
    fail({
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: { date: ['This date is already a holiday.'] },
    });
    expect(open.mock.calls[0][0]).toBe(
      `${en.errors.VALIDATION_FAILED} This date is already a holiday.`,
    );
  });

  it('shows the plain message when a validation failure has no field errors', () => {
    fail({ status: 400, code: 'VALIDATION_FAILED' });
    expect(open.mock.calls[0][0]).toBe(en.errors.VALIDATION_FAILED);
  });

  it('validationMessages flattens and limits field errors', () => {
    const problem = new HttpErrorResponse({
      status: 400,
      error: { errors: { a: ['one', 'two'], b: ['three', 'four'], c: [] } },
    });
    expect(validationMessages(problem)).toEqual(['one', 'two', 'three']);
    expect(validationMessages(null)).toEqual([]);
  });

  it('couponReasonKey only answers for known reasons', () => {
    const problem = (reason: string) => new HttpErrorResponse({ status: 400, error: { reason } });
    for (const r of COUPON_REASONS) {
      expect(couponReasonKey(problem(r))).toBe(`couponReason.${r}`);
      expect((en.couponReason as Record<string, string>)[r]).toBeTruthy();
      expect((ar.couponReason as Record<string, string>)[r]).toBeTruthy();
    }
    expect(couponReasonKey(problem('nope'))).toBeNull();
    expect(couponReasonKey(null)).toBeNull();
  });
});
