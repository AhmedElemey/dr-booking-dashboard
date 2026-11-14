import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';

import { applyBrand } from '../config/brand';

/** Loads `/i18n/<lang>.json` and fills the clinic name into the `{{brand}}` placeholders. */
@Injectable()
export class BrandedTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http
      .get<TranslationObject>(`/i18n/${lang}.json`)
      .pipe(map((t) => applyBrand(t, lang === 'en' ? 'en' : 'ar')));
  }
}
