import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Direction } from '@angular/cdk/bidi';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'ar' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly language = signal<AppLanguage>('ar');
  readonly direction = computed<Direction>(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  use(language: AppLanguage): void {
    this.language.set(language);
    this.translate.use(language);
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = this.direction();
  }

  toggle(): void {
    this.use(this.language() === 'ar' ? 'en' : 'ar');
  }
}
