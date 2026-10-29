import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'ar' | 'en';

const LANGUAGE_KEY = 'moonlight.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality);

  readonly language = signal<AppLanguage>('ar');
  readonly direction = computed<Direction>(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  /** The remembered language (a per-browser convenience), Arabic by default. */
  stored(): AppLanguage {
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
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Storage unavailable: the choice just is not remembered.
    }
    return this.translate.use(language);
  }

  toggle(): void {
    this.use(this.language() === 'ar' ? 'en' : 'ar');
  }
}
