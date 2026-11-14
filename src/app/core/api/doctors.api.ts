import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import {
  BulkSlotsRequest,
  BulkSlotsResult,
  CreateSlotRequest,
  DeleteSlotsResult,
  Doctor,
  Service,
  ServiceRequest,
  Slot,
  SlotQuery,
  Specialty,
  UpdateDoctorRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class DoctorsApi {
  private readonly http = inject(HttpClient);

  private base(doctorId: string): string {
    return apiUrl(`/dashboard/doctors/${doctorId}`);
  }

  list(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(apiUrl('/dashboard/doctors'));
  }

  get(id: string): Observable<Doctor> {
    return this.http.get<Doctor>(this.base(id));
  }

  update(id: string, body: UpdateDoctorRequest): Observable<Doctor> {
    return this.http.put<Doctor>(this.base(id), body);
  }

  uploadPhoto(id: string, file: File): Observable<{ photoUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<{ photoUrl: string }>(`${this.base(id)}/photo`, form);
  }

  specialties(): Observable<Specialty[]> {
    return this.http.get<Specialty[]>(apiUrl('/specialties'));
  }

  // ---- services ----

  services(doctorId: string): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.base(doctorId)}/services`);
  }

  createService(doctorId: string, body: ServiceRequest): Observable<Service> {
    return this.http.post<Service>(`${this.base(doctorId)}/services`, body);
  }

  updateService(doctorId: string, serviceId: string, body: ServiceRequest): Observable<Service> {
    return this.http.put<Service>(`${this.base(doctorId)}/services/${serviceId}`, body);
  }

  deleteService(doctorId: string, serviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(doctorId)}/services/${serviceId}`);
  }

  // ---- slots ----

  slots(doctorId: string, query: SlotQuery): Observable<Slot[]> {
    let params = new HttpParams().set('from', query.from).set('to', query.to);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<Slot[]>(`${this.base(doctorId)}/slots`, { params });
  }

  createSlot(doctorId: string, body: CreateSlotRequest): Observable<Slot> {
    return this.http.post<Slot>(`${this.base(doctorId)}/slots`, body);
  }

  bulkCreateSlots(doctorId: string, body: BulkSlotsRequest): Observable<BulkSlotsResult> {
    return this.http.post<BulkSlotsResult>(`${this.base(doctorId)}/slots/bulk`, body);
  }

  blockSlot(doctorId: string, slotId: string): Observable<Slot> {
    return this.http.post<Slot>(`${this.base(doctorId)}/slots/${slotId}/block`, {});
  }

  unblockSlot(doctorId: string, slotId: string): Observable<Slot> {
    return this.http.post<Slot>(`${this.base(doctorId)}/slots/${slotId}/unblock`, {});
  }

  deleteSlot(doctorId: string, slotId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(doctorId)}/slots/${slotId}`);
  }

  deleteSlotsInRange(doctorId: string, from: string, to: string): Observable<DeleteSlotsResult> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.delete<DeleteSlotsResult>(`${this.base(doctorId)}/slots`, { params });
  }
}
