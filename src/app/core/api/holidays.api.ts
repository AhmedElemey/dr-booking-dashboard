import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { DashboardAppointment } from './models';
import { paramsOf } from './paging';
import { CreateHolidayRequest, Holiday, ImportHolidaysResult } from './phase2.models';

/** holidayCalendar: `/dashboard/holidays`. */
@Injectable({ providedIn: 'root' })
export class HolidaysApi {
  private readonly http = inject(HttpClient);

  list(clinicId: string, year: number): Observable<Holiday[]> {
    return this.http.get<Holiday[]>(apiUrl('/dashboard/holidays'), {
      params: paramsOf({ clinicId, year }),
    });
  }

  create(body: CreateHolidayRequest): Observable<Holiday> {
    return this.http.post<Holiday>(apiUrl('/dashboard/holidays'), body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/dashboard/holidays/${id}`));
  }

  importEgypt(clinicId: string, year: number): Observable<ImportHolidaysResult> {
    return this.http.post<ImportHolidaysResult>(apiUrl('/dashboard/holidays/import-egypt'), {
      clinicId,
      year,
    });
  }

  /** Appointments already booked on the holiday's date (they are left untouched). */
  conflicts(id: string): Observable<DashboardAppointment[]> {
    return this.http.get<DashboardAppointment[]>(apiUrl(`/dashboard/holidays/${id}/conflicts`));
  }
}
