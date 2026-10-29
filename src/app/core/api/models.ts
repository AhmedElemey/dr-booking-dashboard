/** DTO shapes for the endpoints the dashboard calls (spec section 4). */

export type Role = 'Patient' | 'Doctor' | 'ClinicStaff' | 'PlatformAdmin';
export type AppLang = 'ar' | 'en';
export type AppointmentStatus = 'Confirmed' | 'Cancelled' | 'Completed' | 'NoShow';
export type SlotStatus = 'Open' | 'Reserved' | 'Blocked';

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** RFC 7807 problem details with the stable machine `code`. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  code?: string;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}

// ---- Auth & profile -------------------------------------------------------

export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: Role;
  preferredLanguage: AppLang;
  doctorId?: string | null;
  clinicId?: string | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser?: boolean;
  user?: CurrentUser;
}

// ---- Dashboard appointments ----------------------------------------------

export interface DashboardAppointment {
  id: string;
  status: AppointmentStatus;
  slotId: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal?: string;
  timezone: string;
  doctor: { id: string; name: string };
  patient: { id: string; fullName: string | null; phone: string };
  service?: { id: string; name: string; durationMinutes: number; priceEgp?: number | null } | null;
  patientNote?: string | null;
  cancelledBy?: 'Patient' | 'Clinic' | null;
  cancelReason?: string | null;
}

export interface AppointmentQuery {
  doctorId?: string;
  status?: AppointmentStatus;
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAppointmentRequest {
  slotId: string;
  serviceId?: string | null;
  patientPhone: string;
  patientName: string;
  patientNote?: string | null;
}

// ---- Doctors, services, slots --------------------------------------------

export interface Doctor {
  id: string;
  clinicId: string;
  specialtyId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  bioAr?: string | null;
  bioEn?: string | null;
  photoUrl?: string | null;
  yearsExperience?: number | null;
  consultationFeeEgp?: number | null;
  isPublished: boolean;
}

export type UpdateDoctorRequest = Omit<Doctor, 'id' | 'clinicId' | 'slug' | 'photoUrl'>;

export interface Specialty {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface Service {
  id: string;
  doctorId: string;
  nameAr: string;
  nameEn: string;
  durationMinutes: number;
  priceEgp?: number | null;
  isActive: boolean;
}

export type ServiceRequest = Pick<
  Service,
  'nameAr' | 'nameEn' | 'durationMinutes' | 'priceEgp' | 'isActive'
>;

export interface Slot {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  /** Present on `Reserved` slots only. */
  appointmentId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
}

export interface SlotQuery {
  from: string;
  to: string;
  status?: SlotStatus;
}

export interface CreateSlotRequest {
  startsAt: string;
  endsAt: string;
}

/** `daysOfWeek` uses .NET `DayOfWeek` numbering: 0 = Sunday ... 6 = Saturday. */
export interface BulkSlotsRequest {
  fromDate: string;
  toDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface BulkSlotsResult {
  created: number;
  skipped: number;
}

export interface DeleteSlotsResult {
  deleted: number;
  skippedReserved: number;
}

// ---- Clinic & admin -------------------------------------------------------

export interface Clinic {
  id: string;
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  phone: string;
  timezone: string;
  isActive: boolean;
}

export type UpdateClinicRequest = Omit<Clinic, 'id' | 'timezone' | 'isActive'>;
export type CreateClinicRequest = UpdateClinicRequest & { timezone?: string };

export interface CreateClinicUserRequest {
  phone: string;
  fullName: string;
  role: 'Doctor' | 'ClinicStaff';
  nameAr?: string;
  nameEn?: string;
  specialtyId?: string;
}

export interface AdminUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
}
