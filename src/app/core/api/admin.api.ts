import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import {
  AdminClinicFeatures,
  AdminUser,
  Clinic,
  CreateClinicRequest,
  CreateClinicUserRequest,
  Paged,
  UpdateClinicFeaturesRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  clinics(page = 1, pageSize = 20): Observable<Paged<Clinic>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<Paged<Clinic>>(apiUrl('/admin/clinics'), { params });
  }

  createClinic(body: CreateClinicRequest): Observable<Clinic> {
    return this.http.post<Clinic>(apiUrl('/admin/clinics'), body);
  }

  setClinicActive(id: string, isActive: boolean): Observable<Clinic> {
    return this.http.patch<Clinic>(apiUrl(`/admin/clinics/${id}/active`), { isActive });
  }

  clinicFeatures(clinicId: string): Observable<AdminClinicFeatures> {
    return this.http.get<AdminClinicFeatures>(apiUrl(`/admin/clinics/${clinicId}/features`));
  }

  updateClinicFeatures(clinicId: string, body: UpdateClinicFeaturesRequest): Observable<AdminClinicFeatures> {
    return this.http.put<AdminClinicFeatures>(apiUrl(`/admin/clinics/${clinicId}/features`), body);
  }

  createUser(clinicId: string, body: CreateClinicUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>(apiUrl(`/admin/clinics/${clinicId}/users`), body);
  }

  setUserActive(id: string, isActive: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(apiUrl(`/admin/users/${id}/active`), { isActive });
  }
}
