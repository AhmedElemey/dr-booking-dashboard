import { Routes } from '@angular/router';

import { Role } from './core/api/models';
import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/auth/guards';
import { Shell } from './core/layout/shell';

const STAFF: Role[] = ['Doctor', 'ClinicStaff'];
const staffOnly = { canActivate: [roleGuard], data: { roles: STAFF } };

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'agenda',
        ...staffOnly,
        loadComponent: () => import('./features/appointments/agenda').then((m) => m.Agenda),
      },
      {
        path: 'appointments/new',
        ...staffOnly,
        loadComponent: () =>
          import('./features/new-appointment/new-appointment').then((m) => m.NewAppointment),
      },
      {
        path: 'doctors',
        ...staffOnly,
        loadComponent: () => import('./features/doctors/doctors-list').then((m) => m.DoctorsList),
      },
      {
        path: 'doctors/:id',
        ...staffOnly,
        loadComponent: () => import('./features/doctors/doctor-editor').then((m) => m.DoctorEditor),
      },
      {
        path: 'slots',
        ...staffOnly,
        loadComponent: () => import('./features/slots/slot-calendar').then((m) => m.SlotCalendar),
      },
      {
        path: 'clinic',
        ...staffOnly,
        loadComponent: () =>
          import('./features/clinic/clinic-settings').then((m) => m.ClinicSettings),
      },
      {
        path: 'admin/clinics',
        canActivate: [roleGuard],
        data: { roles: ['PlatformAdmin'] satisfies Role[] },
        loadComponent: () => import('./features/admin/admin-clinics').then((m) => m.AdminClinics),
      },
      {
        path: 'account',
        loadComponent: () => import('./features/auth/account').then((m) => m.Account),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
