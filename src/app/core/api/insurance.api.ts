import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { InsuranceProvider, InsuranceProviderRequest } from './phase2.models';

/** insurance: providers CRUD, per-doctor accepted providers. */
@Injectable({ providedIn: 'root' })
export class InsuranceApi {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl('/dashboard/insurance-providers');

  list(): Observable<InsuranceProvider[]> {
    return this.http.get<InsuranceProvider[]>(this.base);
  }

  create(body: InsuranceProviderRequest): Observable<InsuranceProvider> {
    return this.http.post<InsuranceProvider>(this.base, body);
  }

  update(id: string, body: InsuranceProviderRequest): Observable<InsuranceProvider> {
    return this.http.put<InsuranceProvider>(`${this.base}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  setDoctorProviders(
    doctorId: string,
    providerIds: string[],
  ): Observable<{ id: string; name: string }[]> {
    return this.http.put<{ id: string; name: string }[]>(
      apiUrl(`/dashboard/doctors/${doctorId}/insurance-providers`),
      { providerIds },
    );
  }

  /** Approve or reject an appointment's insurance claim. */
  decide(
    appointmentId: string,
    status: 'Approved' | 'Rejected',
    note: string | null,
  ): Observable<unknown> {
    return this.http.post(apiUrl(`/dashboard/appointments/${appointmentId}/insurance`), {
      status,
      note,
    });
  }
}
