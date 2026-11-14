import { Injectable, computed, inject } from '@angular/core';

import { LanguageService } from '../i18n/language.service';
import { BRAND } from './brand';

/** The clinic's name, tagline and logo in the language currently shown. */
@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly languages = inject(LanguageService);

  readonly name = computed(() => BRAND.name[this.languages.language()]);
  readonly tagline = computed(() => BRAND.tagline[this.languages.language()]);
  readonly logo = BRAND.logo;
}
