/** DTOs for the phase 2 endpoints (docs/FEATURES-PHASE2.md). Money is decimal EGP. */

import { AppointmentStatus, DashboardAppointment, DayName, FamilyRelation, Paged } from './models';

export type { Paged };

/** Lists that are paged on the wire may arrive as `{items}` or as a bare array; accept both. */
export type MaybePaged<T> = T[] | Paged<T> | { items: T[]; totalCount?: number };

export interface PageResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ---- holidays ----

export type HolidaySource = 'Manual' | 'EgyptPublic';

export interface Holiday {
  id: string;
  clinicId: string;
  date: string;
  nameAr: string;
  nameEn: string;
  source: HolidaySource;
}

export interface CreateHolidayRequest {
  clinicId: string;
  date: string;
  nameAr: string;
  nameEn: string;
}

export interface ImportHolidaysResult {
  created: number;
  skipped: number;
}

// ---- working-hours templates ----

export interface TemplateRule {
  dayOfWeek: DayName;
  start: string;
  end: string;
}

export interface WorkingHoursTemplate {
  id: string;
  clinicId?: string;
  name: string;
  slotMinutes: number;
  rules: TemplateRule[];
}

export type WorkingHoursTemplateRequest = Pick<
  WorkingHoursTemplate,
  'name' | 'slotMinutes' | 'rules'
>;

// ---- waiting list ----

export type WaitingStatus = 'Waiting' | 'Notified' | 'Booked' | 'Cancelled' | 'Expired';

export interface WaitingListEntry {
  id: string;
  patient: { id: string; fullName: string | null; phone: string };
  familyMember?: { id: string; fullName: string; relation: FamilyRelation } | null;
  doctor: { id: string; name: string };
  date: string;
  serviceId?: string | null;
  status: WaitingStatus;
  notifiedAt?: string | null;
  createdAt: string;
}

export interface WaitingListQuery {
  doctorId?: string;
  date?: string;
  status?: WaitingStatus | '';
}

// ---- payments ----

export type PaymentRecordStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Cancelled';
export type PaymentMethod = 'Online' | 'Cash';

export interface DashboardPayment {
  id: string;
  appointmentId: string;
  amountEgp: number;
  status: PaymentRecordStatus;
  method: PaymentMethod;
  provider?: string | null;
  providerRef?: string | null;
  createdAt: string;
  paidAt?: string | null;
  refundedAt?: string | null;
  patient?: { id: string; fullName: string | null; phone?: string } | null;
  doctor?: { id: string; name: string } | null;
  startsAt?: string | null;
}

export interface PaymentsQuery {
  from: string;
  to: string;
  status?: PaymentRecordStatus | '';
  doctorId?: string;
}

// ---- insurance ----

export interface InsuranceProvider {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}

export type InsuranceProviderRequest = Pick<InsuranceProvider, 'nameAr' | 'nameEn' | 'isActive'>;

// ---- patients ----

export interface PatientRow {
  id: string;
  fullName: string | null;
  phone: string;
  lastVisitAt?: string | null;
  appointmentsCount: number;
}

export interface FamilyMember {
  id: string;
  fullName: string;
  relation: FamilyRelation;
  dateOfBirth?: string | null;
  gender?: 'Male' | 'Female' | null;
}

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface MedicalInfo {
  bloodType?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  medications?: string | null;
  updatedAt?: string | null;
}

export type RecordKind = 'Note' | 'Diagnosis' | 'Prescription' | 'Attachment';

export interface RecordEntry {
  id: string;
  appointmentId?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  authorUserId?: string;
  authorName?: string | null;
  familyMemberId?: string | null;
  kind: RecordKind;
  title: string;
  body?: string | null;
  attachmentUrl?: string | null;
  visibleToPatient: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RecordRequest {
  kind: RecordKind;
  title: string;
  body?: string | null;
  visibleToPatient: boolean;
  appointmentId?: string | null;
  familyMemberId?: string | null;
}

export interface PatientAppointment {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  doctor: { id: string; name: string };
  service?: { id: string; name: string } | null;
  familyMember?: DashboardAppointment['familyMember'];
}

export interface PatientDetail {
  patient: { id: string; fullName: string | null; phone: string };
  familyMembers: FamilyMember[];
  medicalInfo: MedicalInfo | null;
  appointments: PatientAppointment[];
  records: RecordEntry[];
}

// ---- reviews ----

export type ReviewStatus = 'Published' | 'Hidden';

export interface DashboardReview {
  id: string;
  appointmentId?: string;
  doctor: { id: string; name: string };
  /** Flat patient name, as the API sends it. */
  patientName?: string | null;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

export interface ReviewsQuery {
  doctorId?: string;
  status?: ReviewStatus | '';
  page?: number;
}

// ---- coupons ----

export type DiscountType = 'Percent' | 'Fixed';

export interface Coupon {
  id: string;
  clinicId?: string | null;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  discountType: DiscountType;
  value: number;
  maxDiscountEgp?: number | null;
  validFrom: string;
  validTo: string;
  maxRedemptions?: number | null;
  perPatientLimit: number;
  doctorId?: string | null;
  serviceId?: string | null;
  isPublic: boolean;
  isActive: boolean;
  redemptionsCount: number;
  createdAt?: string;
}

export type CouponRequest = Omit<Coupon, 'id' | 'clinicId' | 'redemptionsCount' | 'createdAt'>;

export interface CouponRedemption {
  couponId?: string;
  appointmentId: string;
  patientUserId?: string;
  patientName?: string | null;
  discountEgp: number;
  createdAt: string;
}

// ---- recall campaigns ----

export type RecallChannel = 'Auto' | 'Sms' | 'WhatsApp' | 'Push';
export type RecallMode = 'OneOff' | 'Recurring';

export interface RecallCampaign {
  id: string;
  clinicId?: string;
  name: string;
  messageAr: string;
  messageEn: string;
  channel: RecallChannel;
  monthsSinceLastVisit: number;
  doctorId?: string | null;
  serviceId?: string | null;
  mode: RecallMode;
  isActive: boolean;
  lastRunAt?: string | null;
  createdAt?: string;
}

export type RecallCampaignRequest = Omit<
  RecallCampaign,
  'id' | 'clinicId' | 'lastRunAt' | 'createdAt'
>;

export interface RecallPreview {
  audienceCount: number;
  sample: { name: string; phone: string; lastVisitAt?: string | null }[];
}

export interface RecallSendResult {
  sent: number;
  failed: number;
  skipped: number;
}

export interface RecallSend {
  id: string;
  campaignId?: string;
  patientUserId?: string;
  patientName?: string | null;
  channel: 'Push' | 'Sms' | 'WhatsApp';
  status: 'Sent' | 'Failed' | 'Skipped';
  sentAt: string;
}

// ---- reports ----

export type GroupBy = 'Day' | 'Week' | 'Month';

export interface ReportQuery {
  from: string;
  to: string;
  doctorId?: string;
  groupBy: GroupBy;
}

export interface BookingsReport {
  totals: {
    booked: number;
    completed: number;
    cancelled: number;
    noShow: number;
    cancellationRate: number;
  };
  series: {
    period: string;
    booked: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }[];
  byDoctor: { doctorId: string; name: string; booked: number; completed: number }[];
  byService: { serviceId?: string; name: string; booked: number; completed: number }[];
  bySource: { patient: number; staff: number };
}

export interface RevenueReport {
  totals: {
    expectedEgp: number;
    collectedEgp: number;
    onlineEgp: number;
    cashEgp: number;
    discountsEgp: number;
    refundsEgp: number;
  };
  series: { period: string; expectedEgp: number; collectedEgp: number }[];
  byDoctor: { doctorId: string; name: string; expectedEgp: number; collectedEgp: number }[];
}

// ---- messages ----

export type MessageChannel = 'Push' | 'Sms' | 'WhatsApp';

export interface OutboundMessage {
  id: string;
  channel: MessageChannel;
  to: string;
  userId?: string | null;
  kind: string;
  body: string;
  status: 'Sent' | 'Failed';
  providerRef?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface MessagesQuery {
  channel?: MessageChannel | '';
  from?: string;
  to?: string;
  page?: number;
}

export interface VideoLink {
  joinUrl: string;
  opensAt: string;
  closesAt: string;
}

// ---- live queue ----

/** liveQueue: one row of today's queue: the visit and its 1-based position. */
export interface DashboardQueueEntry {
  appointment: DashboardAppointment;
  position: number;
}
