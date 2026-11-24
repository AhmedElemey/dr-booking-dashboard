import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { FeaturesService } from '../config/features.service';

export type AppLanguage = 'ar' | 'en';

const LANGUAGE_KEY = 'drbooking.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality);
  private readonly features = inject(FeaturesService);
  private readonly dateAdapter = inject<DateAdapter<unknown>>(DateAdapter, { optional: true });

  readonly language = signal<AppLanguage>('ar');
  readonly direction = computed<Direction>(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    // englishLanguage off: the clinic is Arabic only, whatever was remembered or switched to.
    effect(() => {
      if (!this.features.englishLanguage() && this.language() !== 'ar') this.use('ar');
    });
  }

  /** The remembered language (a per-browser convenience), Arabic by default. */
  stored(): AppLanguage {
    if (!this.features.englishLanguage()) return 'ar';
    try {
      return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  }

  use(language: AppLanguage) {
    this.language.set(language);
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = this.direction();
    // Overlays (dialogs, menus, selects) read the root Directionality, which is otherwise
    // only sampled once at startup.
    this.directionality.valueSignal.set(this.direction());
    // Western digits in both languages (matches clinic-time.ts); day-first week layout.
    this.dateAdapter?.setLocale(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Storage unavailable: the choice just is not remembered.
    }
    return this.translate.use(language).pipe(
      tap(() => {
        // Same text as the page title (also set at build time for the first paint).
        const title = this.translate.instant('app.title');
        if (title && title !== 'app.title') this.document.title = title;
      }),
    );
  }

  toggle(): void {
    this.use(this.language() === 'ar' ? 'en' : 'ar');
  }
}
