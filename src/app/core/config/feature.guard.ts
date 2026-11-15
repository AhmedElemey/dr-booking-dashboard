import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { homeFor } from '../auth/guards';
import { AuthService } from '../auth/auth.service';
import { FeatureKey } from './brand';
import { FeaturesService } from './features.service';

/**
 * Makes a route unreachable while its feature switch is off (deep links included): waits for the
 * first answer of `GET /features`, then lets the route through or sends the user home.
 */
export function featureGuard(feature: FeatureKey): CanActivateFn {
  return () => {
    const features = inject(FeaturesService);
    const router = inject(Router);
    const auth = inject(AuthService);
    return features
      .whenSettled()
      .pipe(
        map(() => (features.isOn(feature) ? true : router.createUrlTree([homeFor(auth.role())]))),
      );
  };
}
