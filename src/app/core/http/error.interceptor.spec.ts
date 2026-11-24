import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../config/api-url';
import { KNOWN_ERROR_CODES, errorCode, errorMessageKey } from './error-codes';
import { errorInterceptor } from './error.interceptor';
import { SKIP_ERROR_TOAST } from './http-context';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let open: ReturnType<typeof vi.fn>;
  let translate: TranslateService;

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
    translate = TestBed.inject(TranslateService);
  });

  const fail = (code: string, status: number, context?: HttpContext) => {
    http.get(`${API_ROOT}/x`, { context }).subscribe({ error: () => undefined });
    backend.expectOne(`${API_ROOT}/x`).flush({ status, code }, { status, statusText: 'err' });
  };

  it.each([
    ['SLOT_TAKEN', 409],
    ['SLOT_RESERVED', 409],
    ['SLOT_OVERLAP', 409],
    ['INVALID_TRANSITION', 409],
    ['PHONE_IN_USE', 409],
    ['BOOKING_LIMIT', 409],
  ])('shows the localized message for %s in English', (code, status) => {
    fail(code, status);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe((en.errors as Record<string, string>)[code]);
  });

  it('shows the API detail for INVALID_TRANSITION when it has one', () => {
    http.get(`${API_ROOT}/x`).subscribe({ error: () => undefined });
    backend
      .expectOne(`${API_ROOT}/x`)
      .flush(
        { status: 409, code: 'INVALID_TRANSITION', detail: 'The visit has not started yet.' },
        { status: 409, statusText: 'err' },
      );
    expect(open.mock.calls[0][0]).toBe('The visit has not started yet.');
  });

  function flushTransition(detail: string): void {
    http.get(`${API_ROOT}/x`).subscribe({ error: () => undefined });
    backend
      .expectOne(`${API_ROOT}/x`)
      .flush(
        { status: 409, code: 'INVALID_TRANSITION', detail },
        { status: 409, statusText: 'err' },
      );
  }

  it('shows a known INVALID_TRANSITION detail in Arabic when the UI language is Arabic', () => {
    translate.use('ar');
    flushTransition('The visit has not started yet.');
    expect(open.mock.calls[0][0]).toBe(ar.transitionDetail.notStarted);
  });

  it('localizes "already <status>" details with the translated status', () => {
    translate.use('ar');
    flushTransition('The appointment is already Cancelled.');
    expect(open.mock.calls[0][0]).toBe(
      ar.transitionDetail.alreadyStatus.replace('{{status}}', ar.status.Cancelled),
    );
  });

  it('shows an unknown INVALID_TRANSITION detail as the API wrote it', () => {
    translate.use('ar');
    flushTransition('Something the dashboard has no text for.');
    expect(open.mock.calls[0][0]).toBe('Something the dashboard has no text for.');
  });

  it('shows Arabic messages when the UI language is Arabic', () => {
    translate.use('ar');
    fail('SLOT_TAKEN', 409);
    expect(open.mock.calls[0][0]).toBe(ar.errors.SLOT_TAKEN);
  });

  it('falls back to a generic message for unknown codes', () => {
    fail('SOMETHING_NEW', 418);
    expect(open.mock.calls[0][0]).toBe(en.errors.UNKNOWN);
  });

  it('reports network failures', () => {
    http.get(`${API_ROOT}/x`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_ROOT}/x`).error(new ProgressEvent('error'));
    expect(open.mock.calls[0][0]).toBe(en.errors.NETWORK);
  });

  it('stays quiet when the caller handles the error itself', () => {
    fail('OTP_INVALID', 400, new HttpContext().set(SKIP_ERROR_TOAST, true));
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores failures of non-API requests', () => {
    http.get('https://example.com/x').subscribe({ error: () => undefined });
    backend.expectOne('https://example.com/x').flush('no', { status: 500, statusText: 'err' });
    expect(open).not.toHaveBeenCalled();
  });
});

describe('error codes', () => {
  it('derives codes from the status when the body has none', () => {
    expect(errorMessageKey(errorCode({ status: 0 }))).toBe('errors.UNKNOWN');
    expect(errorMessageKey('SLOT_TAKEN')).toBe('errors.SLOT_TAKEN');
  });

  it('has an Arabic and an English message for every spec error code', () => {
    for (const code of KNOWN_ERROR_CODES) {
      expect((en.errors as Record<string, string>)[code], `en ${code}`).toBeTruthy();
      expect((ar.errors as Record<string, string>)[code], `ar ${code}`).toBeTruthy();
    }
  });
});
