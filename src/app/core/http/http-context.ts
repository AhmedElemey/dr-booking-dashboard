import { HttpContextToken } from '@angular/common/http';

/** Do not attach the bearer token and do not try to refresh on 401. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** The caller shows its own error UI; suppress the global toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Set on the single replay after a token refresh so we never loop. */
export const RETRIED = new HttpContextToken<boolean>(() => false);
