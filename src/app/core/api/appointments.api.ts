import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { AppointmentQuery, CreateAppointmentRequest, DashboardAppointment, Paged } from './models';
import { VideoLink } from './phase2.models';

@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly http = inject(HttpClient);

  list(query: AppointmentQuery): Observable<Paged<DashboardAppointment>> {
    let params = new HttpParams().set('from', query.from).set('to', query.to);
    if (query.doctorId) params = params.set('doctorId', query.doctorId);
    if (query.status) params = params.set('status', query.status);
    params = params.set('page', query.page ?? 1).set('pageSize', query.pageSize ?? 100);
    return this.http.get<Paged<DashboardAppointment>>(apiUrl('/dashboard/appointments'), {
      params,
    });
  }

  get(id: string): Observable<DashboardAppointment> {
    return this.http.get<DashboardAppointment>(apiUrl(`/dashboard/appointments/${id}`));
  }

  create(body: CreateAppointmentRequest): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(apiUrl('/dashboard/appointments'), body);
  }

  reschedule(id: string, slotId: string): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(
      apiUrl(`/dashboard/appointments/${id}/reschedule`),
      {
        slotId,
      },
    );
  }

  cancel(id: string, reason?: string): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(apiUrl(`/dashboard/appointments/${id}/cancel`), {
      reason: reason || null,
    });
  }

  complete(id: string): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(
      apiUrl(`/dashboard/appointments/${id}/complete`),
      {},
    );
  }

  /** Q5: correct a mistaken Completed/NoShow within 24 hours; a corrected no-show refunds the online payment. */
  correctStatus(
    id: string,
    toStatus: 'Completed' | 'NoShow',
    reason?: string,
  ): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(
      apiUrl(`/dashboard/appointments/${id}/correct-status`),
      { toStatus, reason: reason || null },
    );
  }

  noShow(id: string): Observable<DashboardAppointment> {
    return this.http.post<DashboardAppointment>(
      apiUrl(`/dashboard/appointments/${id}/no-show`),
      {},
    );
  }

  /** videoConsultation: the host link; 409 VIDEO_NOT_OPEN outside the window. */
  video(id: string): Observable<VideoLink> {
    return this.http.get<VideoLink>(apiUrl(`/dashboard/appointments/${id}/video`));
  }
}
