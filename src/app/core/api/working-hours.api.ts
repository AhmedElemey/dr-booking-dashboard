import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { ApplyTemplateRequest, BulkSlotsResult, DayName } from './models';
import { WorkingHoursTemplate, WorkingHoursTemplateRequest } from './phase2.models';

const NAMES: DayName[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Accepts a day name or a 0-6 number (Sunday = 0) and returns the day name. */
export function normalizeDay(day: unknown): DayName {
  if (typeof day === 'number') return NAMES[day] ?? 'Sunday';
  return NAMES.find((n) => n.toLowerCase() === String(day).toLowerCase()) ?? 'Sunday';
}

function normalize(t: WorkingHoursTemplate): WorkingHoursTemplate {
  return {
    ...t,
    rules: (t.rules ?? []).map((r) => ({ ...r, dayOfWeek: normalizeDay(r.dayOfWeek) })),
  };
}

/** workingHoursTemplates: `/dashboard/working-hours-templates` and apply-template. */
@Injectable({ providedIn: 'root' })
export class WorkingHoursApi {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl('/dashboard/working-hours-templates');

  list(): Observable<WorkingHoursTemplate[]> {
    return this.http.get<WorkingHoursTemplate[]>(this.base).pipe(map((l) => l.map(normalize)));
  }

  create(body: WorkingHoursTemplateRequest): Observable<WorkingHoursTemplate> {
    return this.http.post<WorkingHoursTemplate>(this.base, body).pipe(map(normalize));
  }

  update(id: string, body: WorkingHoursTemplateRequest): Observable<WorkingHoursTemplate> {
    return this.http.put<WorkingHoursTemplate>(`${this.base}/${id}`, body).pipe(map(normalize));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  apply(doctorId: string, body: ApplyTemplateRequest): Observable<BulkSlotsResult> {
    return this.http.post<BulkSlotsResult>(
      apiUrl(`/dashboard/doctors/${doctorId}/slots/apply-template`),
      body,
    );
  }
}
