import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { provideTestTranslations } from '../../../testing/test-providers';
import { AdminClinics } from '../../features/admin/admin-clinics';
import { LanguageToggle } from '../../shared/language-toggle';
import { AdminApi } from '../api/admin.api';
import { ToastService } from '../http/toast.service';
import { LanguageService } from '../i18n/language.service';
import { BRAND } from './brand';
import { FeaturesService } from './features.service';

describe('feature gating', () => {
  let open: ReturnType<typeof vi.fn>;

  const setup = (lang: 'ar' | 'en' = 'en') => {
    localStorage.clear();
    open = vi.fn();
    TestBed.configureTestingModule({
      imports: [LanguageToggle, AdminClinics],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations(lang),
        { provide: MatSnackBar, useValue: { open } },
        {
          provide: AdminApi,
          useValue: { clinics: () => of({ items: [], totalCount: 0 }) },
        },
      ],
    });
    return TestBed.inject(FeaturesService);
  };

  const render = async <T>(component: new () => T) => {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('shows the language switch when englishLanguage is on', async () => {
    setup();
    const { el } = await render(LanguageToggle);
    expect(el.querySelector('.language-toggle')).not.toBeNull();
  });

  it('hides the language switch and forces Arabic when englishLanguage is off', async () => {
    const features = setup('en');
    const languages = TestBed.inject(LanguageService);
    const { fixture, el } = await render(LanguageToggle);
    expect(languages.language()).toBe('en');

    features.features.update((f) => ({ ...f, englishLanguage: false }));
    TestBed.tick();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('.language-toggle')).toBeNull();
    expect(languages.language()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('remembers nothing but Arabic while englishLanguage is off', () => {
    const features = setup();
    localStorage.setItem('drbooking.language', 'en');
    features.features.update((f) => ({ ...f, englishLanguage: false }));
    expect(TestBed.inject(LanguageService).stored()).toBe('ar');
  });

  it('shows the new clinic button when multiBranch is on, hides it when off', async () => {
    const features = setup();
    const { fixture, el } = await render(AdminClinics);
    expect(features.multiBranch()).toBe(BRAND.features.multiBranch);
    expect(el.querySelector('.page-title button')).not.toBeNull();

    features.features.update((f) => ({ ...f, multiBranch: false }));
    fixture.detectChanges();
    expect(el.querySelector('.page-title button')).toBeNull();
  });

  describe('FEATURE_DISABLED problems', () => {
    const problem = new HttpErrorResponse({
      status: 403,
      error: { status: 403, code: 'FEATURE_DISABLED', feature: 'multiBranch' },
    });

    it('shows a localized English toast and raises the banner', () => {
      const features = setup('en');
      TestBed.inject(ToastService).error(problem);
      expect(open.mock.calls[0][0]).toContain('Multiple branches');
      expect(open.mock.calls[0][0]).toContain('switched off');
      expect(features.disabledNotice()).toBe('multiBranch');
      expect(features.multiBranch()).toBe(false);
    });

    it('shows a localized Arabic toast', () => {
      setup('ar');
      TestBed.inject(ToastService).error(problem);
      expect(open.mock.calls[0][0]).toContain('تعدد الفروع');
      expect(open.mock.calls[0][0]).toContain('غير مفعّلة');
    });

    it('still shows a message for an unknown feature key', () => {
      const features = setup('en');
      TestBed.inject(ToastService).error(
        new HttpErrorResponse({
          status: 403,
          error: { status: 403, code: 'FEATURE_DISABLED', feature: 'futureThing' },
        }),
      );
      expect(open.mock.calls[0][0]).toContain('futureThing');
      expect(features.disabledNotice()).toBeNull();
    });
  });
});
