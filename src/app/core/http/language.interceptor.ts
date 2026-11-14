import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';

import { API_ROOT } from '../config/api-url';
import { LanguageService } from '../i18n/language.service';

/** Sends `Accept-Language` so localized API fields (specialty names, error details) follow the UI. */
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_ROOT)) return next(req);
  // Lazy: LanguageService -> TranslateService -> HTTP loader -> this interceptor.
  const language = inject(Injector).get(LanguageService).language();
  return next(req.clone({ setHeaders: { 'Accept-Language': language } }));
};
