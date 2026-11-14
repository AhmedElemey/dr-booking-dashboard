import { HttpInterceptorFn } from '@angular/common/http';

import { mockBackendInterceptor } from './mock-backend';

/** Demo build only (`--configuration mock`): the fake backend answers all API calls. */
export const mockInterceptors: HttpInterceptorFn[] = [mockBackendInterceptor];
