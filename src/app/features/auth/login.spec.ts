import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { applyBrand } from '../../core/config/brand';
import en from '../../../../public/i18n/en.json';
import { environment } from '../../../environments/environment';
import { provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../../core/config/api-url';
import { Login } from './login';

describe('Login', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('en'),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  async function setup() {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = async (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, type, submit };
  }

  it('blocks an invalid phone number and shows a validation message', async () => {
    const { el, type, submit } = await setup();
    await type('input[type=tel]', '12345');
    await submit();
    backend.expectNone(`${API_ROOT}/auth/otp/request`);
    expect(el.textContent).toContain(en.validation.egyptPhone);
  });

  it('sends the normalized E.164 number and moves to the code step', async () => {
    const { type, submit } = await setup();
    await type('input[type=tel]', '010 1234 5678');
    await submit();
    const req = backend.expectOne(`${API_ROOT}/auth/otp/request`);
    expect(req.request.body).toEqual({ phone: '+201012345678' });
    req.flush(null);
    await Promise.resolve();
    expect(req.request.method).toBe('POST');
  });

  it('shows the localized error inline for a wrong code and does not navigate', async () => {
    const { fixture, el, type, submit } = await setup();
    await type('input[type=tel]', '01012345678');
    await submit();
    backend.expectOne(`${API_ROOT}/auth/otp/request`).flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    await type('input.code-input', '000000');
    await submit();
    backend
      .expectOne(`${API_ROOT}/auth/otp/verify`)
      .flush({ code: 'OTP_INVALID', status: 400 }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain(en.errors.OTP_INVALID);
  });

  it('refuses Patient accounts with a clear message', async () => {
    const { fixture, el, type, submit } = await setup();
    await type('input[type=tel]', '01012345678');
    await submit();
    backend.expectOne(`${API_ROOT}/auth/otp/request`).flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    await type('input.code-input', '123456');
    await submit();
    backend.expectOne(`${API_ROOT}/auth/otp/verify`).flush({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      user: {
        id: 'u',
        phone: '+201012345678',
        fullName: 'P',
        role: 'Patient',
        preferredLanguage: 'ar',
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain(
      applyBrand(en, 'en').errors.ROLE_NOT_ALLOWED,
    );
    expect(localStorage.getItem('drbooking.refreshToken')).toBeNull();
  });

  it('hides the demo banner by default and shows it only when hostedTest is on', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.demo-banner')).toBeNull();
    fixture.destroy();

    (environment as { hostedTest: boolean }).hostedTest = true;
    const fixture2 = TestBed.createComponent(Login);
    fixture2.detectChanges();
    await fixture2.whenStable();
    fixture2.detectChanges();
    expect((fixture2.nativeElement as HTMLElement).querySelector('.demo-banner')).not.toBeNull();
    fixture2.destroy();
    (environment as { hostedTest: boolean }).hostedTest = false;
  });
});
