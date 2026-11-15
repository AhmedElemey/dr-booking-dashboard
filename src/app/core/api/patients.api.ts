import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf, toPage } from './paging';
import {
  MaybePaged,
  MedicalInfo,
  PageResult,
  PatientDetail,
  PatientRow,
  RecordEntry,
  RecordRequest,
} from './phase2.models';

/** patientRecords: patients list, patient record, entries and attachments. */
@Injectable({ providedIn: 'root' })
export class PatientsApi {
  private readonly http = inject(HttpClient);

  list(search: string, page = 1): Observable<PageResult<PatientRow>> {
    return this.http
      .get<MaybePaged<PatientRow>>(apiUrl('/dashboard/patients'), {
        params: paramsOf({ search: search.trim(), page }),
      })
      .pipe(map((raw) => toPage(raw, page)));
  }

  get(userId: string, familyMemberId?: string | null): Observable<PatientDetail> {
    return this.http.get<PatientDetail>(apiUrl(`/dashboard/patients/${userId}`), {
      params: paramsOf({ familyMemberId }),
    });
  }

  saveMedicalInfo(
    userId: string,
    info: MedicalInfo,
    familyMemberId?: string | null,
  ): Observable<MedicalInfo> {
    return this.http.put<MedicalInfo>(apiUrl(`/dashboard/patients/${userId}/medical-info`), {
      ...info,
      familyMemberId: familyMemberId ?? null,
    });
  }

  createRecord(userId: string, body: RecordRequest): Observable<RecordEntry> {
    return this.http.post<RecordEntry>(apiUrl(`/dashboard/patients/${userId}/records`), body);
  }

  updateRecord(id: string, body: RecordRequest): Observable<RecordEntry> {
    return this.http.put<RecordEntry>(apiUrl(`/dashboard/records/${id}`), body);
  }

  deleteRecord(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/dashboard/records/${id}`));
  }

  uploadAttachment(id: string, file: File): Observable<RecordEntry> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<RecordEntry>(apiUrl(`/dashboard/records/${id}/attachment`), form);
  }
}
