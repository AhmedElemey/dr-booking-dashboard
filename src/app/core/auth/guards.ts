import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { Role } from '../api/models';
import { AuthService } from './auth.service';

/** Where each role lands after login. */
export function homeFor(role: Role | null): string {
  return role === 'PlatformAdmin' ? '/admin/clinics' : '/agenda';
}

/** Requires a signed-in non-patient user, restoring the session from `/me` if needed. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .loadUser()
    .pipe(
      map((user) =>
        user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
      ),
    );
};

/** Allows only the roles listed in route `data.roles`; others go to their own home. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data['roles'] as Role[] | undefined) ?? [];
  return auth.loadUser().pipe(
    map((user) => {
      if (!user) return router.createUrlTree(['/login']);
      return allowed.includes(user.role) ? true : router.createUrlTree([homeFor(user.role)]);
    }),
  );
};

/** For the login page: already signed-in users are sent straight to their home. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .loadUser()
    .pipe(map((user) => (user ? router.createUrlTree([homeFor(user.role)]) : true)));
};

/** Redirects the bare `/` to the signed-in user's home screen. */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadUser().pipe(map((user) => router.createUrlTree([homeFor(user?.role ?? null)])));
};
