import { HttpInterceptorFn } from '@angular/common/http';

/**
 * HTTP interceptors for the demo "mock" configuration. In every other build this is empty;
 * `angular.json` swaps in `mock-providers.mock.ts` for `--configuration mock` only, so the
 * fixtures and the fake backend never reach the production bundle.
 */
export const mockInterceptors: HttpInterceptorFn[] = [];
