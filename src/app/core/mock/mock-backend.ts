import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { DateTime } from 'luxon';
import { Observable, delay, of, throwError } from 'rxjs';

import {
  AdminUser,
  AppointmentStatus,
  BulkSlotsRequest,
  CurrentUser,
  DashboardAppointment,
  Slot,
} from '../api/models';
import { API_ROOT } from '../config/api-url';
import { BRAND } from '../config/brand';
import { PHASE2_FEATURE_KEYS } from '../config/brand';
import { dateRange, dayOfWeekNumber, localToUtcIso, minutesOfDay } from '../time/clinic-time';
import { ApiError, Ctx, DOCTOR_ID, Handler, WithHeaders } from './mock-core';
import { CLINIC_ID, MOCK_TZ, MockAppointment, MockState, createMockState } from './mock-data';
import { phase2Routes } from './mock-phase2';

/**
 * Fake API for the demo build. It follows the spec's contract closely enough for the dashboard
 * to be used end to end (booking, transitions, slot edits, admin) without a backend.
 */

const DOCTOR_PHONE = '+201000000011';
const ADMIN_PHONE = '+201000000001';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class MockBackend {
  state: MockState = createMockState();
  private seq = 100;
  /** Language of the request being handled (from Accept-Language). */
  lang: 'ar' | 'en' = 'ar';

  id(prefix: string): string {
    return `${prefix}-${++this.seq}`;
  }

  // ---- helpers ----

  private user(role: Ctx['role']): CurrentUser {
    if (role === 'admin') {
      return {
        id: 'u-admin',
        phone: ADMIN_PHONE,
        fullName: `${BRAND.name.en} Admin`,
        role: 'PlatformAdmin',
        preferredLanguage: 'ar',
      };
    }
    if (role === 'doctor') {
      return {
        id: 'u-doc',
        phone: DOCTOR_PHONE,
        fullName: 'د. سارة حسن',
        role: 'Doctor',
        preferredLanguage: 'ar',
        doctorId: DOCTOR_ID,
        clinicId: CLINIC_ID,
      };
    }
    return {
      id: 'u-staff',
      phone: '+201022222222',
      fullName: 'منى فتحي',
      role: 'ClinicStaff',
      preferredLanguage: 'ar',
      clinicId: CLINIC_ID,
    };
  }

  private roleFromPhone(phone: string): Ctx['role'] {
    if (phone === ADMIN_PHONE) return 'admin';
    if (phone === DOCTOR_PHONE) return 'doctor';
    return 'staff';
  }

  private scopedDoctors(role: Ctx['role']) {
    return this.state.doctors.filter((d) => role !== 'doctor' || d.id === DOCTOR_ID);
  }

  doctorOrThrow(id: string, role: Ctx['role']) {
    const doctor = this.scopedDoctors(role).find((d) => d.id === id || d.slug === id);
    if (!doctor) throw new ApiError(404, 'NOT_FOUND');
    return doctor;
  }

  private slotOrThrow(doctorId: string, slotId: string): Slot {
    const slot = this.state.slots.find((s) => s.id === slotId && s.doctorId === doctorId);
    if (!slot) throw new ApiError(404, 'NOT_FOUND');
    return slot;
  }

  dto(a: MockAppointment): DashboardAppointment {
    const slot = this.state.slots.find((s) => s.id === a.slotId)!;
    const doctor = this.state.doctors.find((d) => d.id === slot.doctorId)!;
    const patient = this.state.patients.find((p) => p.id === a.patientId)!;
    const service = this.state.services.find((s) => s.id === a.serviceId);
    return {
      id: a.id,
      status: a.status,
      slotId: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      startsAtLocal: DateTime.fromISO(slot.startsAt, { zone: MOCK_TZ }).toISO()!,
      timezone: MOCK_TZ,
      doctor: { id: doctor.id, name: this.lang === 'ar' ? doctor.nameAr : doctor.nameEn },
      patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
      service: service
        ? {
            id: service.id,
            name: this.lang === 'ar' ? service.nameAr : service.nameEn,
            durationMinutes: service.durationMinutes,
            priceEgp: service.priceEgp,
          }
        : null,
      patientNote: a.patientNote,
      cancelledBy: a.cancelledBy,
      cancelReason: a.cancelReason,
      checkedInAt: a.checkedInAt,
      startedAt: a.startedAt,
      ...this.phase2Fields(a, doctor.consultationFeeEgp ?? null, service?.priceEgp ?? null),
    };
  }

  /** The phase 2 fields of an appointment DTO: family, mode, price, payment, insurance, review. */
  private phase2Fields(a: MockAppointment, doctorFee: number | null, servicePrice: number | null) {
    const extra = this.state.p2.extras[a.id] ?? {};
    const member = this.state.p2.familyMembers.find((f) => f.id === extra.familyMemberId);
    const provider = this.state.p2.insuranceProviders.find(
      (p) => p.id === extra.insurance?.providerId,
    );
    const price = servicePrice ?? doctorFee;
    const discount = extra.discountEgp ?? 0;
    return {
      familyMember: member
        ? { id: member.id, fullName: member.fullName, relation: member.relation }
        : null,
      mode: extra.mode ?? 'InPerson',
      priceEgp: price,
      discountEgp: discount,
      totalEgp: price === null ? null : Math.max(0, price - discount),
      paymentStatus: extra.paymentStatus ?? 'Unpaid',
      insurance:
        extra.insurance && provider
          ? {
              provider: {
                id: provider.id,
                name: this.lang === 'ar' ? provider.nameAr : provider.nameEn,
              },
              memberNumber: extra.insurance.memberNumber,
              status: extra.insurance.status,
              note: extra.insurance.note ?? null,
            }
          : null,
      review: extra.review ?? null,
    } satisfies Partial<DashboardAppointment>;
  }

  /** A doctor as the dashboard returns it: with the accepted insurance providers by name. */
  doctorView(doctor: MockState['doctors'][number]) {
    const ids = this.state.p2.doctorInsurance[doctor.id] ?? [];
    return {
      ...doctor,
      insuranceProviders: this.state.p2.insuranceProviders
        .filter((p) => ids.includes(p.id))
        .map((p) => ({ id: p.id, name: this.lang === 'ar' ? p.nameAr : p.nameEn })),
    };
  }

  appointmentOrThrow(id: string, role: Ctx['role']): MockAppointment {
    const a = this.state.appointments.find((x) => x.id === id);
    const slot = a && this.state.slots.find((s) => s.id === a.slotId);
    if (!a || !slot || (role === 'doctor' && slot.doctorId !== DOCTOR_ID))
      throw new ApiError(404, 'NOT_FOUND');
    return a;
  }

  localDate(iso: string): string {
    return DateTime.fromISO(iso, { zone: MOCK_TZ }).toFormat('yyyy-MM-dd');
  }

  private slotWithPatient(slot: Slot): Slot {
    if (slot.status !== 'Reserved') return { ...slot, appointmentId: null };
    const a = this.state.appointments.find((x) => x.slotId === slot.id && x.status !== 'Cancelled');
    const patient = a && this.state.patients.find((p) => p.id === a.patientId);
    return {
      ...slot,
      appointmentId: a?.id ?? null,
      patientName: patient?.fullName,
      patientPhone: patient?.phone,
    };
  }

  page<T>(items: T[], query: URLSearchParams) {
    const page = Number(query.get('page') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 20);
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: items.length,
    };
  }

  private requireConfirmed(a: MockAppointment): void {
    if (a.status !== 'Confirmed') throw new ApiError(409, 'INVALID_TRANSITION');
  }

  private startsAt(a: MockAppointment): DateTime {
    return DateTime.fromISO(this.state.slots.find((s) => s.id === a.slotId)!.startsAt);
  }

  private setStatus(a: MockAppointment, status: AppointmentStatus): void {
    a.status = status;
  }

  // ---- routes ----

  private routes: [string, RegExp, Handler][] = [
    // auth
    ['POST', /^\/auth\/otp\/request$/, () => null],
    [
      'POST',
      /^\/auth\/otp\/verify$/,
      ({ body }) => {
        if (body['code'] !== '123456') throw new ApiError(400, 'OTP_INVALID');
        const role = this.roleFromPhone(String(body['phone']));
        return {
          accessToken: `mock-access-${role}`,
          refreshToken: `mock-refresh-${role}`,
          expiresIn: 900,
          isNewUser: false,
          user: this.user(role),
        };
      },
    ],
    [
      'POST',
      /^\/auth\/refresh$/,
      ({ body }) => {
        const match = /^mock-refresh-(staff|doctor|admin)$/.exec(String(body['refreshToken']));
        if (!match) throw new ApiError(401, 'UNAUTHORIZED');
        return {
          accessToken: `mock-access-${match[1]}`,
          refreshToken: `mock-refresh-${match[1]}`,
          expiresIn: 900,
        };
      },
    ],
    ['POST', /^\/auth\/logout$/, () => null],
    ['GET', /^\/me$/, ({ role }) => this.user(role)],
    ['PUT', /^\/me$/, ({ role, body }) => ({ ...this.user(role), ...body })],
    [
      'GET',
      /^\/specialties$/,
      ({ req }) =>
        this.state.specialties.map((s) => ({
          id: s.id,
          name: req.headers.get('Accept-Language') === 'en' ? s.nameEn : s.nameAr,
        })),
    ],

    // dashboard appointments
    [
      'GET',
      /^\/dashboard\/appointments$/,
      ({ query, role }) => {
        const from = query.get('from')!;
        const to = query.get('to')!;
        const doctorId = query.get('doctorId');
        const status = query.get('status');
        const items = this.state.appointments
          .map((a) => this.dto(a))
          .filter((a) => {
            const day = this.localDate(a.startsAt);
            return (
              day >= from &&
              day <= to &&
              (!doctorId || a.doctor.id === doctorId) &&
              (!status || a.status === status) &&
              (role !== 'doctor' || a.doctor.id === DOCTOR_ID)
            );
          })
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        return this.page(items, query);
      },
    ],
    // liveQueue: today's queue (registered before the by-id GET so `queue` is not read as an id)
    [
      'GET',
      /^\/dashboard\/appointments\/queue$/,
      ({ query, role }) => {
        const doctorId = query.get('doctorId');
        const today = this.localDate(DateTime.now().toUTC().toISO()!);
        const now = DateTime.now();
        const inScope = this.state.appointments
          .filter((a) => {
            const slot = this.state.slots.find((s) => s.id === a.slotId)!;
            if (this.localDate(slot.startsAt) !== today) return false;
            if (role === 'doctor' && slot.doctorId !== DOCTOR_ID) return false;
            if (doctorId && slot.doctorId !== doctorId) return false;
            if (a.status === 'InProgress' || a.status === 'CheckedIn') return true;
            return a.status === 'Confirmed' && DateTime.fromISO(slot.startsAt) >= now;
          })
          .sort((a, b) => {
            const rank = (s: AppointmentStatus) =>
              s === 'InProgress' ? 0 : s === 'CheckedIn' ? 1 : 2;
            const byRank = rank(a.status) - rank(b.status);
            if (byRank !== 0) return byRank;
            const at = (x: MockAppointment) =>
              x.status === 'InProgress'
                ? (x.startedAt ?? '')
                : x.status === 'CheckedIn'
                  ? (x.checkedInAt ?? '')
                  : this.startsAt(x).toISO()!;
            const byTime = at(a).localeCompare(at(b));
            return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
          });
        return inScope.map((a, i) => ({ appointment: this.dto(a), position: i + 1 }));
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/check-in$/,
      ({ params, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        this.requireConfirmed(a);
        const today = this.localDate(DateTime.now().toUTC().toISO()!);
        if (this.localDate(this.startsAt(a).toISO()!) !== today)
          throw new ApiError(409, 'INVALID_TRANSITION');
        a.status = 'CheckedIn';
        a.checkedInAt = DateTime.now().toUTC().toISO();
        return this.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/start$/,
      ({ params, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        if (a.status !== 'CheckedIn') throw new ApiError(409, 'INVALID_TRANSITION');
        const doctorId = this.state.slots.find((s) => s.id === a.slotId)!.doctorId;
        const busy = this.state.appointments.some(
          (x) =>
            x.id !== a.id &&
            x.status === 'InProgress' &&
            this.state.slots.find((s) => s.id === x.slotId)!.doctorId === doctorId,
        );
        if (busy) throw new ApiError(409, 'DOCTOR_BUSY');
        a.status = 'InProgress';
        a.startedAt = DateTime.now().toUTC().toISO();
        return this.dto(a);
      },
    ],
    [
      'GET',
      /^\/dashboard\/appointments\/([^/]+)$/,
      ({ params, role }) => this.dto(this.appointmentOrThrow(params[0], role)),
    ],
    [
      'POST',
      /^\/dashboard\/appointments$/,
      ({ body, role }) => {
        const slot = this.state.slots.find((s) => s.id === body['slotId']);
        if (!slot || (role === 'doctor' && slot.doctorId !== DOCTOR_ID))
          throw new ApiError(404, 'NOT_FOUND');
        if (slot.status !== 'Open') throw new ApiError(409, 'SLOT_TAKEN');
        if (DateTime.fromISO(slot.startsAt) < DateTime.now())
          throw new ApiError(409, 'SLOT_UNAVAILABLE');
        if (this.state.p2.holidays.some((h) => h.date === this.localDate(slot.startsAt)))
          throw new ApiError(409, 'CLINIC_CLOSED');
        const mode = body['mode'] === 'Video' ? 'Video' : 'InPerson';
        if (
          mode === 'Video' &&
          !this.state.doctors.find((d) => d.id === slot.doctorId)?.offersVideo
        )
          throw new ApiError(422, 'VALIDATION_FAILED');
        const phone = String(body['patientPhone']);
        if (phone === DOCTOR_PHONE || phone === ADMIN_PHONE)
          throw new ApiError(409, 'PHONE_IN_USE');
        let patient = this.state.patients.find((p) => p.phone === phone);
        if (!patient) {
          patient = { id: this.id('pt'), fullName: String(body['patientName']), phone };
          this.state.patients.push(patient);
        }
        slot.status = 'Reserved';
        const appointment: MockAppointment = {
          id: this.id('apt'),
          slotId: slot.id,
          patientId: patient.id,
          serviceId: (body['serviceId'] as string | null) || null,
          status: 'Confirmed',
          patientNote: (body['patientNote'] as string | null) ?? null,
          cancelledBy: null,
          cancelReason: null,
          checkedInAt: null,
          startedAt: null,
        };
        this.state.appointments.push(appointment);
        if (mode === 'Video') this.state.p2.extras[appointment.id] = { mode };
        return this.dto(appointment);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/reschedule$/,
      ({ params, body, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        this.requireConfirmed(a);
        const oldSlot = this.state.slots.find((s) => s.id === a.slotId)!;
        const target = this.state.slots.find(
          (s) => s.id === body['slotId'] && s.doctorId === oldSlot.doctorId,
        );
        if (!target) throw new ApiError(404, 'NOT_FOUND');
        if (target.status !== 'Open') throw new ApiError(409, 'SLOT_TAKEN');
        oldSlot.status = 'Open';
        target.status = 'Reserved';
        a.slotId = target.id;
        return this.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/cancel$/,
      ({ params, body, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        this.requireConfirmed(a);
        if (this.startsAt(a) <= DateTime.now()) throw new ApiError(409, 'INVALID_TRANSITION');
        this.setStatus(a, 'Cancelled');
        a.cancelledBy = 'Clinic';
        a.cancelReason = (body['reason'] as string | null) ?? null;
        this.state.slots.find((s) => s.id === a.slotId)!.status = 'Open';
        return this.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/approve$/,
      ({ params, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        if (a.status !== 'Pending') throw new ApiError(409, 'INVALID_TRANSITION');
        this.setStatus(a, 'Confirmed');
        return this.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/reject$/,
      ({ params, body, role }) => {
        const a = this.appointmentOrThrow(params[0], role);
        if (a.status !== 'Pending') throw new ApiError(409, 'INVALID_TRANSITION');
        this.setStatus(a, 'Cancelled');
        a.cancelledBy = 'Clinic';
        a.cancelReason = (body['reason'] as string | null) ?? null;
        this.state.slots.find((s) => s.id === a.slotId)!.status = 'Open';
        return this.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/complete$/,
      ({ params, role }) => this.finish(params[0], role, 'Completed'),
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/no-show$/,
      ({ params, role }) => this.finish(params[0], role, 'NoShow'),
    ],

    // dashboard doctors
    [
      'GET',
      /^\/dashboard\/doctors$/,
      ({ role }) => this.scopedDoctors(role).map((d) => this.doctorView(d)),
    ],
    [
      'GET',
      /^\/dashboard\/doctors\/([^/]+)$/,
      ({ params, role }) => this.doctorView(this.doctorOrThrow(params[0], role)),
    ],
    [
      'PUT',
      /^\/dashboard\/doctors\/([^/]+)$/,
      ({ params, body, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        Object.assign(doctor, body);
        return this.doctorView(doctor);
      },
    ],
    [
      'PUT',
      /^\/dashboard\/doctors\/([^/]+)\/photo$/,
      ({ params, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        doctor.photoUrl = null;
        return { photoUrl: '' };
      },
    ],
    [
      'GET',
      /^\/dashboard\/doctors\/([^/]+)\/services$/,
      ({ params, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        return this.state.services
          .filter((s) => s.doctorId === doctor.id)
          .map((s) => ({ ...s, doctorId: undefined }));
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/services$/,
      ({ params, body, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const service = {
          id: this.id('sv'),
          doctorId: doctor.id,
          ...body,
        } as MockState['services'][number];
        this.state.services.push(service);
        return service;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/doctors\/([^/]+)\/services\/([^/]+)$/,
      ({ params, body, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const service = this.state.services.find(
          (s) => s.id === params[1] && s.doctorId === doctor.id,
        );
        if (!service) throw new ApiError(404, 'NOT_FOUND');
        Object.assign(service, body);
        return service;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/doctors\/([^/]+)\/services\/([^/]+)$/,
      ({ params, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const service = this.state.services.find(
          (s) => s.id === params[1] && s.doctorId === doctor.id,
        );
        if (!service) throw new ApiError(404, 'NOT_FOUND');
        service.isActive = false;
        return null;
      },
    ],

    // slots
    [
      'GET',
      /^\/dashboard\/doctors\/([^/]+)\/slots$/,
      ({ params, query, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const from = query.get('from')!;
        const to = query.get('to')!;
        const status = query.get('status');
        return this.state.slots
          .filter((s) => s.doctorId === doctor.id && (!status || s.status === status))
          .filter((s) => this.localDate(s.startsAt) >= from && this.localDate(s.startsAt) <= to)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .map((s) => this.slotWithPatient(s));
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/slots$/,
      ({ params, body, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const start = DateTime.fromISO(String(body['startsAt']));
        const end = DateTime.fromISO(String(body['endsAt']));
        if (start < DateTime.now()) throw new ApiError(400, 'VALIDATION_FAILED');
        if (this.overlaps(doctor.id, start, end)) throw new ApiError(409, 'SLOT_OVERLAP');
        const slot: Slot = {
          id: this.id('slot'),
          doctorId: doctor.id,
          startsAt: start.toUTC().toISO()!,
          endsAt: end.toUTC().toISO()!,
          status: 'Open',
        };
        this.state.slots.push(slot);
        return slot;
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/slots\/bulk$/,
      ({ params, body, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        return this.bulk(doctor.id, body as unknown as BulkSlotsRequest);
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/slots\/([^/]+)\/block$/,
      ({ params, role }) => {
        const slot = this.slotOrThrow(this.doctorOrThrow(params[0], role).id, params[1]);
        if (slot.status === 'Reserved') throw new ApiError(409, 'SLOT_RESERVED');
        if (slot.status === 'Open') slot.status = 'Blocked';
        return slot;
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/slots\/([^/]+)\/unblock$/,
      ({ params, role }) => {
        const slot = this.slotOrThrow(this.doctorOrThrow(params[0], role).id, params[1]);
        if (slot.status === 'Blocked') slot.status = 'Open';
        return slot;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/doctors\/([^/]+)\/slots\/([^/]+)$/,
      ({ params, role }) => {
        const slot = this.slotOrThrow(this.doctorOrThrow(params[0], role).id, params[1]);
        if (slot.status === 'Reserved') throw new ApiError(409, 'SLOT_RESERVED');
        this.state.slots = this.state.slots.filter((s) => s.id !== slot.id);
        return null;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/doctors\/([^/]+)\/slots$/,
      ({ params, query, role }) => {
        const doctor = this.doctorOrThrow(params[0], role);
        const from = query.get('from')!;
        const to = query.get('to')!;
        const inRange = this.state.slots.filter(
          (s) =>
            s.doctorId === doctor.id &&
            this.localDate(s.startsAt) >= from &&
            this.localDate(s.startsAt) <= to,
        );
        const removable = inRange.filter((s) => s.status !== 'Reserved');
        const ids = new Set(removable.map((s) => s.id));
        this.state.slots = this.state.slots.filter((s) => !ids.has(s.id));
        return { deleted: removable.length, skippedReserved: inRange.length - removable.length };
      },
    ],

    // runtime config (public)
    [
      'GET',
      /^\/features$/,
      () => ({
        // The demo shows everything: all thirteen phase 2 features are on.
        features: {
          ...BRAND.features,
          ...Object.fromEntries(PHASE2_FEATURE_KEYS.map((key) => [key, true])),
        },
        source: 'defaults',
        updatedAt: new Date().toISOString(),
      }),
    ],
    [
      'GET',
      /^\/branding$/,
      () => ({
        slug: BRAND.slug,
        name: BRAND.name,
        tagline: BRAND.tagline,
        colors: BRAND.colors,
        supportPhone: BRAND.supportPhone,
        logoUrl: BRAND.logo,
      }),
    ],

    // clinic
    ['GET', /^\/dashboard\/clinic$/, () => this.state.clinics.find((c) => c.id === CLINIC_ID)],
    [
      'PUT',
      /^\/dashboard\/clinic$/,
      ({ body }) => {
        const clinic = this.state.clinics.find((c) => c.id === CLINIC_ID)!;
        Object.assign(clinic, body);
        return clinic;
      },
    ],

    // admin
    ['GET', /^\/admin\/clinics$/, ({ query }) => this.page(this.state.clinics, query)],
    [
      'POST',
      /^\/admin\/clinics$/,
      ({ body }) => {
        const clinic = {
          id: this.id('clinic'),
          isActive: true,
          timezone: MOCK_TZ,
          ...body,
        } as MockState['clinics'][number];
        this.state.clinics.unshift(clinic);
        return clinic;
      },
    ],
    [
      'PATCH',
      /^\/admin\/clinics\/([^/]+)\/active$/,
      ({ params, body }) => {
        const clinic = this.state.clinics.find((c) => c.id === params[0]);
        if (!clinic) throw new ApiError(404, 'NOT_FOUND');
        clinic.isActive = Boolean(body['isActive']);
        return clinic;
      },
    ],
    [
      'POST',
      /^\/admin\/clinics\/([^/]+)\/users$/,
      ({ params, body }) => {
        if (!this.state.clinics.some((c) => c.id === params[0]))
          throw new ApiError(404, 'NOT_FOUND');
        if (this.state.patients.some((p) => p.phone === body['phone']))
          throw new ApiError(409, 'PHONE_IN_USE');
        const user: AdminUser = {
          id: this.id('u'),
          phone: String(body['phone']),
          fullName: String(body['fullName']),
          role: body['role'] as AdminUser['role'],
          isActive: true,
          isAdmin: body['role'] === 'ClinicStaff' ? body['isAdmin'] === true : null,
        };
        return user;
      },
    ],
    [
      'PATCH',
      /^\/admin\/users\/([^/]+)\/admin$/,
      ({ params, body }) => ({
        id: params[0],
        phone: '',
        fullName: null,
        role: 'ClinicStaff',
        isActive: true,
        isAdmin: Boolean(body['isAdmin']),
      }),
    ],
    [
      'PATCH',
      /^\/admin\/users\/([^/]+)\/active$/,
      ({ params, body }) => ({
        id: params[0],
        phone: '',
        fullName: null,
        role: 'Doctor',
        isActive: Boolean(body['isActive']),
      }),
    ],
  ];

  private readonly phase2 = phase2Routes(this);

  private finish(
    id: string,
    role: Ctx['role'],
    status: 'Completed' | 'NoShow',
  ): DashboardAppointment {
    const a = this.appointmentOrThrow(id, role);
    // liveQueue widens the close-out rule: complete from checked-in or with-the-doctor,
    // no-show from checked-in.
    const allowed: AppointmentStatus[] =
      status === 'Completed' ? ['Confirmed', 'CheckedIn', 'InProgress'] : ['Confirmed', 'CheckedIn'];
    if (!allowed.includes(a.status)) throw new ApiError(409, 'INVALID_TRANSITION');
    if (a.status !== 'InProgress' && this.startsAt(a) > DateTime.now())
      throw new ApiError(409, 'INVALID_TRANSITION');
    this.setStatus(a, status);
    return this.dto(a);
  }

  overlaps(doctorId: string, start: DateTime, end: DateTime): boolean {
    return this.state.slots.some(
      (s) =>
        s.doctorId === doctorId &&
        DateTime.fromISO(s.startsAt) < end &&
        DateTime.fromISO(s.endsAt) > start,
    );
  }

  bulk(doctorId: string, req: BulkSlotsRequest) {
    let created = 0;
    let skipped = 0;
    const startMin = minutesOfDay(req.startTime)!;
    const endMin = minutesOfDay(req.endTime)!;
    const holidays = new Set(this.state.p2.holidays.map((h) => h.date));
    const skippedSlots: { startsAt: string; endsAt: string; local: string; reason: string }[] = [];
    for (const date of dateRange(req.fromDate, req.toDate)) {
      if (!(req.daysOfWeek as string[]).includes(DAY_NAMES[dayOfWeekNumber(date)])) continue;
      for (let m = startMin; m + req.slotMinutes <= endMin; m += req.slotMinutes) {
        const time = (min: number) =>
          `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
        const startIso = localToUtcIso(date, time(m), MOCK_TZ);
        const endIso = localToUtcIso(date, time(m + req.slotMinutes), MOCK_TZ);
        if (!startIso || !endIso) continue;
        const start = DateTime.fromISO(startIso);
        const end = DateTime.fromISO(endIso);
        if (holidays.has(date)) {
          skipped++;
          skippedSlots.push({
            startsAt: startIso,
            endsAt: endIso,
            local: `${date} ${time(m)}`,
            reason: 'holiday',
          });
          continue;
        }
        if (start < DateTime.now() || this.overlaps(doctorId, start, end)) {
          skipped++;
          continue;
        }
        this.state.slots.push({
          id: this.id('slot'),
          doctorId,
          startsAt: startIso,
          endsAt: endIso,
          status: 'Open',
        });
        created++;
      }
    }
    return skippedSlots.length ? { created, skipped, skippedSlots } : { created, skipped };
  }

  // ---- dispatch ----

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = new URL(req.url, 'http://mock.local');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const isPublic =
      path.startsWith('/auth/otp') ||
      path === '/auth/refresh' ||
      path === '/specialties' ||
      path === '/features' ||
      path === '/branding';

    const auth = req.headers.get('Authorization');
    const role = (/^Bearer mock-access-(staff|doctor|admin)$/.exec(auth ?? '')?.[1] ??
      'staff') as Ctx['role'];

    this.lang = req.headers.get('Accept-Language') === 'en' ? 'en' : 'ar';

    try {
      if (!isPublic && !auth) throw new ApiError(401, 'UNAUTHORIZED');
      const route = [...this.routes, ...this.phase2].find(
        ([method, pattern]) => method === req.method && pattern.test(path),
      );
      if (!route) throw new ApiError(404, 'NOT_FOUND');
      const match = route[1].exec(path)!;
      const body = (req.body && !(req.body instanceof FormData) ? req.body : {}) as Record<
        string,
        unknown
      >;
      const result = route[2]({
        req,
        params: match.slice(1),
        body,
        query: new URLSearchParams(
          req.params.keys().flatMap((k) => req.params.getAll(k)!.map((v) => [k, v])),
        ),
        role,
      });
      const payload = result instanceof WithHeaders ? result.body : result;
      // Clone so callers never share references with the store.
      return of(
        new HttpResponse({
          status: payload === null ? 204 : 200,
          headers: result instanceof WithHeaders ? new HttpHeaders(result.headers) : undefined,
          body: payload === null || payload instanceof Blob ? payload : structuredClone(payload),
        }),
      ).pipe(delay(120));
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      return throwError(
        () =>
          new HttpErrorResponse({
            status: e.status,
            url: req.url,
            error: { status: e.status, code: e.code, title: e.code, ...e.extra },
          }),
      ).pipe(delay(120));
    }
  }
}

const backend = new MockBackend();

/** Answers every call to the API from the in-memory store. Never reaches the network. */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith(API_ROOT) ? backend.handle(req) : next(req);
