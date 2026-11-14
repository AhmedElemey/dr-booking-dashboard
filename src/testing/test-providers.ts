import {
  EnvironmentProviders,
  Provider,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';

import ar from '../../public/i18n/ar.json';
import en from '../../public/i18n/en.json';
import { applyBrand } from '../app/core/config/brand';
import { LanguageService } from '../app/core/i18n/language.service';
import { Clock } from '../app/core/time/clock';

/** Translation providers loaded with the real ar/en files, starting in `lang`. */
export function provideTestTranslations(
  lang: 'ar' | 'en' = 'en',
): (Provider | EnvironmentProviders)[] {
  return [
    provideTranslateService({ fallbackLang: 'en' }),
    provideEnvironmentInitializer(() => {
      const translate = inject(TranslateService);
      translate.setTranslation('en', applyBrand(en, 'en'));
      translate.setTranslation('ar', applyBrand(ar, 'ar'));
      translate.use(lang);
      inject(LanguageService).use(lang);
    }),
  ];
}

/** Freezes the app clock at a clinic-local instant. */
export function provideFixedClock(clinicLocalIso: string): Provider {
  return {
    provide: Clock,
    useValue: { now: () => DateTime.fromISO(clinicLocalIso, { zone: 'Africa/Cairo' }) },
  };
}

export const flatten = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
