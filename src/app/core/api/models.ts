/** DTO shapes for the endpoints the dashboard calls (spec section 4). */

export type Role = 'Patient' | 'Doctor' | 'ClinicStaff' | 'PlatformAdmin';
export type AppLang = 'ar' | 'en';
export type AppointmentStatus =
  | 'Confirmed'
  | 'Cancelled'
  | 'Completed'
  | 'NoShow'
  | 'CheckedIn'
  | 'InProgress';
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
  /** With code FEATURE_DISABLED: the switched-off feature key. */
  feature?: string;
  /** With code COUPON_INVALID: why the coupon was refused. */
  reason?: string;
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
  /** ClinicStaff only: a clinic admin may correct a closed visit's status. */
  isClinicAdmin?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser?: boolean;
  user: CurrentUser;
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

  // ---- phase 2 (always present from the API; only meaningful when the feature is on) ----
  /** familyAccounts: set when the visit is for a family member. `patient` is then the booker. */
  familyMember?: FamilyMemberRef | null;
  /** videoConsultation. */
  mode?: AppointmentMode;
  /** onlinePayments. */
  priceEgp?: number | null;
  discountEgp?: number | null;
  totalEgp?: number | null;
  paymentStatus?: PaymentStatus;
  /** insurance. */
  insurance?: AppointmentInsurance | null;
  /** reviews. */
  review?: { rating: number; comment?: string | null } | null;
  /** liveQueue: when the patient announced themselves at the clinic. */
  checkedInAt?: string | null;
  /** liveQueue: when the doctor started the visit. */
  startedAt?: string | null;
}

export type AppointmentMode = 'InPerson' | 'Video';
export type PaymentStatus = 'Unpaid' | 'Pending' | 'Paid' | 'Refunded';
export type FamilyRelation = 'Child' | 'Spouse' | 'Parent' | 'Sibling' | 'Other';
export type InsuranceStatus = 'Pending' | 'Approved' | 'Rejected';

export interface FamilyMemberRef {
  id: string;
  fullName: string;
  relation: FamilyRelation;
}

export interface AppointmentInsurance {
  provider: { id: string; name: string };
  memberNumber: string;
  status: InsuranceStatus;
  note?: string | null;
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
  /** videoConsultation: omitted (in person) unless the doctor offers video. */
  mode?: AppointmentMode;
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
  /** videoConsultation. */
  offersVideo?: boolean;
  /** insurance: the providers this doctor accepts. */
  insuranceProviders?: { id: string; name: string }[];
}

export type UpdateDoctorRequest = Omit<
  Doctor,
  'id' | 'clinicId' | 'slug' | 'photoUrl' | 'insuranceProviders'
>;

/** Localized by the `Accept-Language` header (the API returns one `name`). */
export interface Specialty {
  id: string;
  name: string;
}

export interface Service {
  id: string;
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

export type DayName =
  'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

/** `daysOfWeek` are English day names (the API serializes enums as strings). */
export interface BulkSlotsRequest {
  fromDate: string;
  toDate: string;
  daysOfWeek: DayName[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface BulkSlotsResult {
  created: number;
  skipped: number;
  skippedSlots?: { startsAt: string; endsAt: string; local: string; reason: string }[] | null;
}

export interface ApplyTemplateRequest {
  templateId: string;
  fromDate: string;
  toDate: string;
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
  /** When false, the public website and app hide consultation and service prices. */
  showPrices: boolean;
}

export type UpdateClinicRequest = Omit<Clinic, 'id' | 'timezone' | 'isActive'>;
export type CreateClinicRequest = Omit<UpdateClinicRequest, 'showPrices'> & { timezone?: string };

export interface CreateClinicUserRequest {
  phone: string;
  fullName: string;
  role: 'Doctor' | 'ClinicStaff';
  nameAr?: string;
  nameEn?: string;
  specialtyId?: string;
  isAdmin?: boolean;
}

export interface AdminUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  clinicId?: string | null;
  doctorId?: string | null;
  isAdmin?: boolean | null;
}
