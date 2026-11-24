import { Routes } from '@angular/router';

import { Role } from './core/api/models';
import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/auth/guards';
import { featureGuard } from './core/config/feature.guard';
import { FeatureKey } from './core/config/brand';
import { Shell } from './core/layout/shell';

const STAFF: Role[] = ['Doctor', 'ClinicStaff'];
const staffOnly = { canActivate: [roleGuard], data: { roles: STAFF } };

/** Only clinic staff (not doctors) and only while `feature` is switched on. */
const clinicFeature = (feature: FeatureKey) => ({
  canActivate: [roleGuard, featureGuard(feature)],
  data: { roles: ['ClinicStaff'] satisfies Role[] },
});
/** Staff and doctors (a doctor sees only their own data) while `feature` is switched on. */
const staffFeature = (feature: FeatureKey) => ({
  canActivate: [roleGuard, featureGuard(feature)],
  data: { roles: STAFF },
});
/** Clinic staff and platform admins. */
const adminFeature = (feature: FeatureKey) => ({
  canActivate: [roleGuard, featureGuard(feature)],
  data: { roles: ['ClinicStaff', 'PlatformAdmin'] satisfies Role[] },
});

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
        path: 'holidays',
        ...clinicFeature('holidayCalendar'),
        loadComponent: () => import('./features/holidays/holidays').then((m) => m.Holidays),
      },
      {
        path: 'working-hours',
        ...clinicFeature('workingHoursTemplates'),
        loadComponent: () =>
          import('./features/working-hours/working-hours').then((m) => m.WorkingHours),
      },
      {
        path: 'waiting-list',
        ...staffFeature('waitingList'),
        loadComponent: () =>
          import('./features/waiting-list/waiting-list').then((m) => m.WaitingList),
      },
      {
        path: 'queue',
        ...staffFeature('liveQueue'),
        loadComponent: () => import('./features/queue/queue').then((m) => m.Queue),
      },
      {
        path: 'payments',
        ...staffFeature('onlinePayments'),
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'insurance',
        ...adminFeature('insurance'),
        loadComponent: () =>
          import('./features/insurance/insurance-providers').then((m) => m.InsuranceProviders),
      },
      {
        path: 'patients',
        ...staffFeature('patientRecords'),
        loadComponent: () => import('./features/patients/patients').then((m) => m.Patients),
      },
      {
        path: 'patients/:id',
        ...staffFeature('patientRecords'),
        loadComponent: () =>
          import('./features/patients/patient-record').then((m) => m.PatientRecord),
      },
      {
        path: 'reviews',
        ...staffFeature('reviews'),
        loadComponent: () => import('./features/reviews/reviews').then((m) => m.Reviews),
      },
      {
        path: 'coupons',
        ...clinicFeature('promotions'),
        loadComponent: () => import('./features/coupons/coupons').then((m) => m.Coupons),
      },
      {
        path: 'recall',
        ...clinicFeature('recallCampaigns'),
        loadComponent: () => import('./features/recall/recall').then((m) => m.Recall),
      },
      {
        path: 'reports',
        ...staffFeature('reports'),
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'messages',
        ...adminFeature('whatsappReminders'),
        loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
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
