import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { languageInterceptor } from './core/http/language.interceptor';
import { FeaturesService } from './core/config/features.service';
import { BrandedTranslateLoader } from './core/i18n/branded-loader';
import { LanguageService } from './core/i18n/language.service';
import { mockInterceptors } from './core/mock/mock-providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: the error interceptor sits outside the auth interceptor so it only
    // reports failures that survive a token refresh. The mock backend (demo builds only)
    // is innermost and answers instead of the network.
    provideHttpClient(
      withInterceptors([
        languageInterceptor,
        errorInterceptor,
        authInterceptor,
        ...mockInterceptors,
      ]),
    ),
    provideTranslateService({
      loader: { provide: TranslateLoader, useClass: BrandedTranslateLoader },
      fallbackLang: 'en',
    }),
    provideAppInitializer(() => {
      // Not awaited: the cached or default switches apply until the first answer arrives.
      inject(FeaturesService).start();
    }),
    provideAppInitializer(() => {
      const languages = inject(LanguageService);
      return languages.use(languages.stored());
    }),
  ],
};
