import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { provideTestTranslations } from '../../../testing/test-providers';
import { API_ROOT } from '../config/api-url';
import { LanguageService } from '../i18n/language.service';
import { languageInterceptor } from './language.interceptor';

describe('languageInterceptor', () => {
  it('sends the UI language as Accept-Language to the API only', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor])),
        provideHttpClientTesting(),
        provideTestTranslations('ar'),
      ],
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);

    http.get(`${API_ROOT}/specialties`).subscribe();
    expect(
      backend.expectOne(`${API_ROOT}/specialties`).request.headers.get('Accept-Language'),
    ).toBe('ar');

    TestBed.inject(LanguageService).use('en');
    http.get(`${API_ROOT}/specialties`).subscribe();
    expect(
      backend.expectOne(`${API_ROOT}/specialties`).request.headers.get('Accept-Language'),
    ).toBe('en');

    http.get('/i18n/en.json').subscribe();
    expect(backend.expectOne('/i18n/en.json').request.headers.has('Accept-Language')).toBe(false);
  });
});
