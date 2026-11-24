import { DateTime } from 'luxon';

import { DashboardAppointment, DayName } from '../api/models';
import {
  BookingsReport,
  Coupon,
  CouponRequest,
  DashboardPayment,
  DashboardReview,
  Holiday,
  InsuranceProvider,
  MedicalInfo,
  PatientAppointment,
  PatientDetail,
  RecallCampaign,
  RecallPreview,
  RevenueReport,
  WaitingListEntry,
  WorkingHoursTemplate,
} from '../api/phase2.models';
import { dateRange, dayOfWeekNumber, localToUtcIso, minutesOfDay } from '../time/clinic-time';
import {
  EGYPT_FIXED_HOLIDAYS,
  EGYPT_MOVEABLE_HOLIDAYS,
  MockApptExtra,
  MockRecord,
  holidayId,
} from './mock-data-phase2';
import {
  ApiError,
  Ctx,
  DOCTOR_ID,
  DOCTOR_USER_ID,
  Handler,
  STAFF_USER_ID,
  WithHeaders,
  attachmentPath,
  validationError,
} from './mock-core';
import type { MockBackend } from './mock-backend';
import { CLINIC_ID, MOCK_TZ } from './mock-data';

const DAY_NAMES: DayName[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Deterministic pseudo-random numbers so the demo reports look the same on every load. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOM = '\uFEFF';

/** A copy of `value` without the listed (server-side only) keys. */
function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Routes for the thirteen phase 2 features, added to the base fake backend. */
export function phase2Routes(backend: MockBackend): [string, RegExp, Handler][] {
  const p2 = () => backend.state.p2;
  const ar = () => backend.lang === 'ar';
  const doctorName = (id: string) => {
    const d = backend.state.doctors.find((x) => x.id === id);
    return d ? (ar() ? d.nameAr : d.nameEn) : '';
  };
  const scopedDoctorId = (ctx: Ctx, wanted: string | null): string | null =>
    ctx.role === 'doctor' ? DOCTOR_ID : wanted || null;
  const nowIso = () => new Date().toISOString();
  const today = () => DateTime.now().setZone(MOCK_TZ).toFormat('yyyy-MM-dd');
  const localDay = (iso: string) => DateTime.fromISO(iso, { zone: MOCK_TZ }).toFormat('yyyy-MM-dd');

  const holidayDates = () => new Set(p2().holidays.map((h) => h.date));

  const requireDate = (value: unknown): string => {
    const date = String(value ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'VALIDATION_FAILED');
    return date;
  };

  const doctorDto = (id: string) => ({ id, name: doctorName(id) });

  const apptExtra = (id: string): MockApptExtra => (p2().extras[id] ??= {});

  const addMessage = (
    to: string,
    kind: string,
    body: string,
    channel: 'Push' | 'Sms' | 'WhatsApp' = 'WhatsApp',
  ) =>
    p2().messages.unshift({
      id: backend.id('m'),
      channel,
      to,
      kind,
      body,
      status: 'Sent',
      createdAt: nowIso(),
    });

  // ---- reports engine ----

  interface Day {
    date: string;
    doctorId: string;
    booked: number;
    completed: number;
    cancelled: number;
    noShow: number;
    expected: number;
    collected: number;
    online: number;
    discounts: number;
    refunds: number;
  }

  const WEIGHT: Record<string, number> = { 'doc-sara': 1.25, 'doc-omar': 1, 'doc-mona': 0.7 };

  const days = (from: string, to: string, doctorId: string | null): Day[] => {
    const rows: Day[] = [];
    const todayKey = today();
    for (const date of dateRange(from, to)) {
      if (dayOfWeekNumber(date) === 5) continue; // Friday off
      for (const doctor of backend.state.doctors) {
        if (doctorId && doctor.id !== doctorId) continue;
        const rand = rng(`${date}|${doctor.id}`);
        const booked = Math.round((3 + rand() * 5) * (WEIGHT[doctor.id] ?? 1));
        const past = date <= todayKey;
        const cancelled = past
          ? Math.round(booked * (0.07 + rand() * 0.1))
          : Math.round(booked * 0.05);
        const noShow = past ? Math.round(booked * rand() * 0.07) : 0;
        const completed = past ? Math.max(booked - cancelled - noShow, 0) : 0;
        const price = doctor.consultationFeeEgp ?? 350;
        const expected = Math.round(completed * (price + rand() * 120));
        const collected = Math.round(expected * (0.82 + rand() * 0.12));
        rows.push({
          date,
          doctorId: doctor.id,
          booked,
          completed,
          cancelled,
          noShow,
          expected,
          collected,
          online: Math.round(collected * 0.55),
          discounts: Math.round(expected * 0.03),
          refunds: Math.round(cancelled * price * 0.35),
        });
      }
    }
    return rows;
  };

  const periodOf = (date: string, groupBy: string): string => {
    const d = DateTime.fromISO(date);
    if (groupBy === 'Month') return d.toFormat('yyyy-MM');
    if (groupBy === 'Week') return d.toFormat("kkkk-'W'WW");
    return date;
  };

  const reportRange = (query: URLSearchParams) => {
    const from = requireDate(query.get('from'));
    const to = requireDate(query.get('to'));
    const count = dateRange(from, to).length;
    if (count < 1 || count > 366) throw new ApiError(400, 'VALIDATION_FAILED');
    return { from, to, groupBy: query.get('groupBy') || 'Day' };
  };

  const csv = (header: string[], rows: (string | number)[][]) =>
    new Blob([BOM + [header, ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n'], {
      type: 'text/csv;charset=utf-8',
    });

  const bookingsReport = (query: URLSearchParams, role: Ctx['role']) => {
    const { from, to, groupBy } = reportRange(query);
    const rows = days(from, to, scopedDoctorId({ role } as Ctx, query.get('doctorId')));
    const series = new Map<string, BookingsReport['series'][number]>();
    for (const r of rows) {
      const key = periodOf(r.date, groupBy);
      const s = series.get(key) ?? {
        period: key,
        booked: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
      };
      s.booked += r.booked;
      s.completed += r.completed;
      s.cancelled += r.cancelled;
      s.noShow += r.noShow;
      series.set(key, s);
    }
    const sum = (k: 'booked' | 'completed' | 'cancelled' | 'noShow') =>
      rows.reduce((t, r) => t + r[k], 0);
    const booked = sum('booked');
    const byDoctor = backend.state.doctors
      .map((d) => ({
        doctorId: d.id,
        name: doctorName(d.id),
        booked: rows.filter((r) => r.doctorId === d.id).reduce((t, r) => t + r.booked, 0),
        completed: rows.filter((r) => r.doctorId === d.id).reduce((t, r) => t + r.completed, 0),
      }))
      .filter((d) => d.booked > 0);
    const services = backend.state.services.filter((s) =>
      byDoctor.some((d) => d.doctorId === s.doctorId),
    );
    const byService = services.map((s) => {
      const doc = byDoctor.find((d) => d.doctorId === s.doctorId)!;
      const share = (rng(s.id)() + 0.5) / services.filter((x) => x.doctorId === s.doctorId).length;
      return {
        serviceId: s.id,
        name: ar() ? s.nameAr : s.nameEn,
        booked: Math.round(doc.booked * Math.min(share * 0.6, 0.7)),
        completed: Math.round(doc.completed * Math.min(share * 0.6, 0.7)),
      };
    });
    const report: BookingsReport = {
      totals: {
        booked,
        completed: sum('completed'),
        cancelled: sum('cancelled'),
        noShow: sum('noShow'),
        cancellationRate: booked ? Math.round((sum('cancelled') / booked) * 1000) / 1000 : 0,
      },
      series: [...series.values()],
      byDoctor,
      byService,
      bySource: { patient: Math.round(booked * 0.68), staff: booked - Math.round(booked * 0.68) },
    };
    return { report, format: query.get('format') };
  };

  const revenueReport = (query: URLSearchParams, role: Ctx['role']) => {
    const { from, to, groupBy } = reportRange(query);
    const rows = days(from, to, scopedDoctorId({ role } as Ctx, query.get('doctorId')));
    const series = new Map<string, RevenueReport['series'][number]>();
    for (const r of rows) {
      const key = periodOf(r.date, groupBy);
      const s = series.get(key) ?? { period: key, expectedEgp: 0, collectedEgp: 0 };
      s.expectedEgp += r.expected;
      s.collectedEgp += r.collected;
      series.set(key, s);
    }
    const sum = (k: 'expected' | 'collected' | 'online' | 'discounts' | 'refunds') =>
      rows.reduce((t, r) => t + r[k], 0);
    const report: RevenueReport = {
      totals: {
        expectedEgp: sum('expected'),
        collectedEgp: sum('collected'),
        onlineEgp: sum('online'),
        cashEgp: sum('collected') - sum('online'),
        discountsEgp: sum('discounts'),
        refundsEgp: sum('refunds'),
      },
      series: [...series.values()],
      byDoctor: backend.state.doctors
        .map((d) => ({
          doctorId: d.id,
          name: doctorName(d.id),
          expectedEgp: rows.filter((r) => r.doctorId === d.id).reduce((t, r) => t + r.expected, 0),
          collectedEgp: rows
            .filter((r) => r.doctorId === d.id)
            .reduce((t, r) => t + r.collected, 0),
        }))
        .filter((d) => d.expectedEgp > 0),
    };
    return { report, format: query.get('format') };
  };

  // ---- patients helpers ----

  const apptsOfPatient = (patientId: string) =>
    backend.state.appointments.filter((a) => a.patientId === patientId);

  const visiblePatients = (role: Ctx['role']) =>
    backend.state.patients.filter(
      (p) =>
        role !== 'doctor' ||
        apptsOfPatient(p.id).some(
          (a) => backend.state.slots.find((s) => s.id === a.slotId)?.doctorId === DOCTOR_ID,
        ),
    );

  const patientOrThrow = (id: string, role: Ctx['role']) => {
    const patient = visiblePatients(role).find((p) => p.id === id);
    if (!patient) throw new ApiError(404, 'NOT_FOUND');
    return patient;
  };

  const medicalKey = (patientId: string, memberId: unknown) => `${patientId}|${memberId || ''}`;

  const recordOrThrow = (id: string, role: Ctx['role']): MockRecord => {
    const record = p2().records.find((r) => r.id === id);
    if (!record) throw new ApiError(404, 'NOT_FOUND');
    patientOrThrow(record.patientId, role);
    if (role === 'doctor' && record.authorUserId !== DOCTOR_USER_ID) {
      throw new ApiError(403, 'FORBIDDEN');
    }
    return record;
  };

  // ---- role rules and template validation (as the real API enforces them) ----

  const staffOnly = (role: Ctx['role']) => {
    if (role !== 'staff') throw new ApiError(403, 'FORBIDDEN');
  };

  const onGrid = (time: unknown) => {
    const minutes = typeof time === 'string' ? minutesOfDay(time) : null;
    return minutes !== null && minutes % 15 === 0;
  };

  const validateTemplate = (body: Record<string, unknown>) => {
    const errors: Record<string, string[]> = {};
    if (!body['name']) errors['name'] = ['name is required.'];
    const slotMinutes = Number(body['slotMinutes']);
    if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240 || slotMinutes % 15)
      errors['slotMinutes'] = ['slotMinutes must be a multiple of 15 between 15 and 240.'];
    const rules = Array.isArray(body['rules']) ? (body['rules'] as Record<string, unknown>[]) : [];
    if (rules.length === 0) errors['rules'] = ['At least one rule is required.'];
    rules.forEach((rule, i) => {
      if (!onGrid(rule['start']))
        errors[`rules[${i}].start`] = ['start must be HH:mm on a 15-minute boundary.'];
      if (!onGrid(rule['end']))
        errors[`rules[${i}].end`] = ['end must be HH:mm on a 15-minute boundary.'];
    });
    if (Object.keys(errors).length > 0) throw validationError(errors);
  };

  // ---- coupons ----

  const couponBody = (body: Record<string, unknown>, existingId?: string): CouponRequest => {
    const code = String(body['code'] ?? '').toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw new ApiError(400, 'VALIDATION_FAILED');
    if (p2().coupons.some((c) => c.code === code && c.id !== existingId)) {
      throw validationError({ code: ['This coupon code is already in use.'] });
    }
    return { ...(body as unknown as CouponRequest), code };
  };

  const view = <T extends { doctor: { id: string; name: string } }>(rows: T[]): T[] =>
    rows.map((r) => ({ ...r, doctor: doctorDto(r.doctor.id) }));

  return [
    // ---- holidays ----
    [
      'GET',
      /^\/dashboard\/holidays$/,
      ({ query }) => {
        const year = String(query.get('year') ?? DateTime.now().year);
        return p2()
          .holidays.filter((h) => h.date.startsWith(year))
          .sort((a, b) => a.date.localeCompare(b.date));
      },
    ],
    [
      'POST',
      /^\/dashboard\/holidays$/,
      ({ body }) => {
        const date = requireDate(body['date']);
        if (!body['nameAr'] || !body['nameEn']) throw new ApiError(400, 'VALIDATION_FAILED');
        if (p2().holidays.some((h) => h.date === date))
          throw validationError({ date: ['This date is already a holiday.'] });
        const holiday: Holiday = {
          id: backend.id('hol'),
          clinicId: CLINIC_ID,
          date,
          nameAr: String(body['nameAr']),
          nameEn: String(body['nameEn']),
          source: 'Manual',
        };
        p2().holidays.push(holiday);
        return holiday;
      },
    ],
    [
      'POST',
      /^\/dashboard\/holidays\/import-egypt$/,
      ({ body }) => {
        const year = Number(body['year']);
        const table = [...EGYPT_FIXED_HOLIDAYS, ...(EGYPT_MOVEABLE_HOLIDAYS[year] ?? [])];
        let created = 0;
        let skipped = 0;
        for (const [md, nameAr, nameEn] of table) {
          const date = `${year}-${md}`;
          if (p2().holidays.some((h) => h.date === date)) {
            skipped++;
            continue;
          }
          p2().holidays.push({
            id: holidayId(CLINIC_ID, date),
            clinicId: CLINIC_ID,
            date,
            nameAr,
            nameEn,
            source: 'EgyptPublic',
          });
          created++;
        }
        return { created, skipped };
      },
    ],
    [
      'GET',
      /^\/dashboard\/holidays\/([^/]+)\/conflicts$/,
      ({ params }) => {
        const holiday = p2().holidays.find((h) => h.id === params[0]);
        if (!holiday) throw new ApiError(404, 'NOT_FOUND');
        return backend.state.appointments
          .filter((a) => a.status === 'Confirmed')
          .map((a) => backend.dto(a))
          .filter((a: DashboardAppointment) => localDay(a.startsAt) === holiday.date);
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/holidays\/([^/]+)$/,
      ({ params }) => {
        if (!p2().holidays.some((h) => h.id === params[0])) throw new ApiError(404, 'NOT_FOUND');
        p2().holidays = p2().holidays.filter((h) => h.id !== params[0]);
        return null;
      },
    ],

    // ---- working-hours templates ----
    // Doctors may list templates (to apply one); only staff change them.
    ['GET', /^\/dashboard\/working-hours-templates$/, () => p2().templates],
    [
      'POST',
      /^\/dashboard\/working-hours-templates$/,
      ({ body, role }) => {
        staffOnly(role);
        validateTemplate(body);
        const template = {
          id: backend.id('wht'),
          clinicId: CLINIC_ID,
          ...body,
        } as WorkingHoursTemplate;
        p2().templates.push(template);
        return template;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/working-hours-templates\/([^/]+)$/,
      ({ params, body, role }) => {
        staffOnly(role);
        const template = p2().templates.find((t) => t.id === params[0]);
        if (!template) throw new ApiError(404, 'NOT_FOUND');
        validateTemplate({ ...template, ...body });
        Object.assign(template, body);
        return template;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/working-hours-templates\/([^/]+)$/,
      ({ params, role }) => {
        staffOnly(role);
        if (!p2().templates.some((t) => t.id === params[0])) throw new ApiError(404, 'NOT_FOUND');
        p2().templates = p2().templates.filter((t) => t.id !== params[0]);
        return null;
      },
    ],
    [
      'POST',
      /^\/dashboard\/doctors\/([^/]+)\/slots\/apply-template$/,
      ({ params, body, role }) => {
        const doctor = backend.doctorOrThrow(params[0], role);
        const template = p2().templates.find((t) => t.id === body['templateId']);
        if (!template) throw new ApiError(404, 'NOT_FOUND');
        const holidays = holidayDates();
        let created = 0;
        const skippedSlots: { startsAt: string; endsAt: string; local: string; reason: string }[] =
          [];
        for (const date of dateRange(requireDate(body['fromDate']), requireDate(body['toDate']))) {
          const rules = template.rules.filter(
            (r) => r.dayOfWeek === DAY_NAMES[dayOfWeekNumber(date)],
          );
          for (const rule of rules) {
            const startMin = minutesOfDay(rule.start)!;
            const endMin = minutesOfDay(rule.end)!;
            for (let m = startMin; m + template.slotMinutes <= endMin; m += template.slotMinutes) {
              const t = (min: number) =>
                `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
              const startIso = localToUtcIso(date, t(m), MOCK_TZ);
              const endIso = localToUtcIso(date, t(m + template.slotMinutes), MOCK_TZ);
              if (!startIso || !endIso) continue;
              const reason = holidays.has(date)
                ? 'holiday'
                : DateTime.fromISO(startIso) < DateTime.now()
                  ? 'past'
                  : backend.overlaps(
                        doctor.id,
                        DateTime.fromISO(startIso),
                        DateTime.fromISO(endIso),
                      )
                    ? 'overlap'
                    : null;
              if (reason) {
                skippedSlots.push({
                  startsAt: startIso,
                  endsAt: endIso,
                  local: `${date} ${t(m)}`,
                  reason,
                });
                continue;
              }
              backend.state.slots.push({
                id: backend.id('slot'),
                doctorId: doctor.id,
                startsAt: startIso,
                endsAt: endIso,
                status: 'Open',
              });
              created++;
            }
          }
        }
        return { created, skipped: skippedSlots.length, skippedSlots };
      },
    ],

    // ---- waiting list ----
    [
      'GET',
      /^\/dashboard\/waiting-list$/,
      (ctx) => {
        const doctorId = scopedDoctorId(ctx, ctx.query.get('doctorId'));
        const date = ctx.query.get('date');
        const status = ctx.query.get('status');
        return view(
          p2()
            .waiting.filter(
              (w) =>
                (!doctorId || w.doctorId === doctorId) &&
                (!date || w.date === date) &&
                (!status || w.status === status),
            )
            .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
            .map((w) => omit(w, 'doctorId', 'patientId') as WaitingListEntry),
        );
      },
    ],
    [
      'POST',
      /^\/dashboard\/waiting-list\/([^/]+)\/notify$/,
      ({ params, role }) => {
        const entry = p2().waiting.find((w) => w.id === params[0]);
        if (!entry || (role === 'doctor' && entry.doctorId !== DOCTOR_ID))
          throw new ApiError(404, 'NOT_FOUND');
        if (entry.status !== 'Waiting' && entry.status !== 'Notified')
          throw new ApiError(409, 'INVALID_TRANSITION');
        entry.status = 'Notified';
        entry.notifiedAt = nowIso();
        addMessage(
          entry.patient.phone,
          'waiting_list',
          `توفر موعد مع ${doctorName(entry.doctorId)} يوم ${entry.date}. احجز الآن.`,
        );
        return { notified: true };
      },
    ],

    // ---- payments ----
    [
      'GET',
      /^\/dashboard\/payments$/,
      (ctx) => {
        const from = requireDate(ctx.query.get('from'));
        const to = requireDate(ctx.query.get('to'));
        const status = ctx.query.get('status');
        const doctorId = scopedDoctorId(ctx, ctx.query.get('doctorId'));
        return p2()
          .payments.filter((p) => {
            const day = localDay(p.paidAt ?? p.createdAt);
            return (
              day >= from &&
              day <= to &&
              (!status || p.status === status) &&
              (!doctorId || p.doctor?.id === doctorId)
            );
          })
          .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt))
          .map((p): DashboardPayment => ({
            ...p,
            doctor: p.doctor ? doctorDto(p.doctor.id) : null,
          }));
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/mark-paid$/,
      ({ params, role }) => {
        const a = backend.appointmentOrThrow(params[0], role);
        const dto = backend.dto(a);
        if (
          a.status === 'Cancelled' ||
          dto.paymentStatus === 'Paid' ||
          dto.paymentStatus === 'Refunded' ||
          !(dto.totalEgp! > 0)
        )
          throw new ApiError(409, 'PAYMENT_NOT_ALLOWED');
        const slot = backend.state.slots.find((s) => s.id === a.slotId)!;
        const patient = backend.state.patients.find((p) => p.id === a.patientId)!;
        const payment: DashboardPayment = {
          id: backend.id('pay'),
          appointmentId: a.id,
          amountEgp: dto.totalEgp!,
          status: 'Paid',
          method: 'Cash',
          provider: 'Cash',
          createdAt: nowIso(),
          paidAt: nowIso(),
          patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
          doctor: { id: slot.doctorId, name: '' },
          startsAt: slot.startsAt,
        };
        p2().payments.push(payment);
        Object.assign(apptExtra(a.id), { paymentStatus: 'Paid', paymentId: payment.id });
        return backend.dto(a);
      },
    ],
    [
      'POST',
      /^\/dashboard\/payments\/([^/]+)\/refund$/,
      ({ params, role }) => {
        staffOnly(role);
        const payment = p2().payments.find((p) => p.id === params[0]);
        if (!payment) throw new ApiError(404, 'NOT_FOUND');
        if (payment.status !== 'Paid') throw new ApiError(409, 'PAYMENT_NOT_ALLOWED');
        payment.status = 'Refunded';
        payment.refundedAt = nowIso();
        apptExtra(payment.appointmentId).paymentStatus = 'Refunded';
        return payment;
      },
    ],

    // ---- insurance ----
    ['GET', /^\/dashboard\/insurance-providers$/, () => p2().insuranceProviders],
    [
      'POST',
      /^\/dashboard\/insurance-providers$/,
      ({ body }) => {
        if (!body['nameAr'] || !body['nameEn']) throw new ApiError(400, 'VALIDATION_FAILED');
        const provider = { id: backend.id('ins'), isActive: true, ...body } as InsuranceProvider;
        p2().insuranceProviders.push(provider);
        return provider;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/insurance-providers\/([^/]+)$/,
      ({ params, body }) => {
        const provider = p2().insuranceProviders.find((p) => p.id === params[0]);
        if (!provider) throw new ApiError(404, 'NOT_FOUND');
        Object.assign(provider, body);
        return provider;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/insurance-providers\/([^/]+)$/,
      ({ params }) => {
        if (!p2().insuranceProviders.some((p) => p.id === params[0]))
          throw new ApiError(404, 'NOT_FOUND');
        p2().insuranceProviders = p2().insuranceProviders.filter((p) => p.id !== params[0]);
        for (const ids of Object.values(p2().doctorInsurance)) {
          const i = ids.indexOf(params[0]);
          if (i >= 0) ids.splice(i, 1);
        }
        return null;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/doctors\/([^/]+)\/insurance-providers$/,
      ({ params, body, role }) => {
        const doctor = backend.doctorOrThrow(params[0], role);
        const ids = (body['providerIds'] as string[]) ?? [];
        if (ids.some((id) => !p2().insuranceProviders.some((p) => p.id === id)))
          throw new ApiError(400, 'VALIDATION_FAILED');
        p2().doctorInsurance[doctor.id] = [...ids];
        return ids.map((id) => {
          const provider = p2().insuranceProviders.find((p) => p.id === id)!;
          return { id, name: backend.lang === 'ar' ? provider.nameAr : provider.nameEn };
        });
      },
    ],
    [
      'POST',
      /^\/dashboard\/appointments\/([^/]+)\/insurance$/,
      ({ params, body, role }) => {
        const a = backend.appointmentOrThrow(params[0], role);
        const insurance = apptExtra(a.id).insurance;
        if (!insurance) throw new ApiError(404, 'NOT_FOUND');
        if (body['status'] !== 'Approved' && body['status'] !== 'Rejected')
          throw new ApiError(400, 'VALIDATION_FAILED');
        insurance.status = body['status'];
        insurance.note = (body['note'] as string | null) ?? undefined;
        return backend.dto(a);
      },
    ],

    // ---- video ----
    [
      'GET',
      /^\/dashboard\/appointments\/([^/]+)\/video$/,
      ({ params, role }) => {
        const a = backend.appointmentOrThrow(params[0], role);
        if (apptExtra(a.id).mode !== 'Video') throw new ApiError(404, 'NOT_FOUND');
        const slot = backend.state.slots.find((s) => s.id === a.slotId)!;
        const opens = DateTime.fromISO(slot.startsAt).minus({ minutes: 15 });
        const closes = DateTime.fromISO(slot.endsAt).plus({ minutes: 30 });
        if (a.status !== 'Confirmed' || DateTime.now() < opens || DateTime.now() > closes)
          throw new ApiError(409, 'VIDEO_NOT_OPEN');
        return {
          joinUrl: `https://meet.jit.si/moonlight-${a.id}-host`,
          opensAt: opens.toUTC().toISO(),
          closesAt: closes.toUTC().toISO(),
        };
      },
    ],

    // ---- patients ----
    [
      'GET',
      /^\/dashboard\/patients$/,
      (ctx) => {
        const search = (ctx.query.get('search') ?? '').trim().toLowerCase();
        const rows = visiblePatients(ctx.role)
          .filter(
            (p) =>
              !search ||
              p.fullName.toLowerCase().includes(search) ||
              p.phone.replace('+', '').includes(search.replace('+', '')),
          )
          .map((p) => {
            const appts = apptsOfPatient(p.id);
            const past = appts
              .filter((a) => a.status !== 'Cancelled')
              .map((a) => backend.state.slots.find((s) => s.id === a.slotId)!.startsAt)
              .filter((iso) => DateTime.fromISO(iso) <= DateTime.now())
              .sort();
            return {
              id: p.id,
              fullName: p.fullName,
              phone: p.phone,
              lastVisitAt: past.at(-1) ?? null,
              appointmentsCount: appts.length,
              noShowCount: appts.filter((a) => a.status === 'NoShow').length,
            };
          })
          .sort((a, b) => (b.lastVisitAt ?? '').localeCompare(a.lastVisitAt ?? ''));
        // The real API returns a bare array (20 per page) and the total in a header.
        return new WithHeaders(backend.page(rows, ctx.query).items, {
          'X-Total-Count': String(rows.length),
        });
      },
    ],
    [
      'GET',
      /^\/dashboard\/patients\/([^/]+)$/,
      ({ params, query, role }): PatientDetail => {
        const patient = patientOrThrow(params[0], role);
        const member = query.get('familyMemberId') || '';
        const appointments: PatientAppointment[] = apptsOfPatient(patient.id)
          .filter((a) => (p2().extras[a.id]?.familyMemberId ?? '') === member)
          .map((a) => backend.dto(a))
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
          .map((d) => ({
            id: d.id,
            status: d.status,
            startsAt: d.startsAt,
            endsAt: d.endsAt,
            timezone: d.timezone,
            doctor: d.doctor,
            service: d.service ? { id: d.service.id, name: d.service.name } : null,
            familyMember: d.familyMember,
          }));
        return {
          patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
          noShowCount: apptsOfPatient(patient.id).filter((a) => a.status === 'NoShow').length,
          familyMembers: p2()
            .familyMembers.filter((f) => f.ownerId === patient.id)
            .map((f) => omit(f, 'ownerId')),
          medicalInfo: p2().medical[medicalKey(patient.id, member)] ?? null,
          appointments,
          records: p2()
            .records.filter(
              (r) => r.patientId === patient.id && (r.familyMemberId ?? '') === member,
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((r) => omit(r, 'patientId')),
        };
      },
    ],
    [
      'PUT',
      /^\/dashboard\/patients\/([^/]+)\/medical-info$/,
      ({ params, body, role }) => {
        const patient = patientOrThrow(params[0], role);
        const { familyMemberId, ...info } = body;
        const saved: MedicalInfo = { ...(info as MedicalInfo), updatedAt: nowIso() };
        p2().medical[medicalKey(patient.id, familyMemberId)] = saved;
        return saved;
      },
    ],
    [
      'POST',
      /^\/dashboard\/patients\/([^/]+)\/records$/,
      ({ params, body, role }) => {
        const patient = patientOrThrow(params[0], role);
        if (!body['title'] || !body['kind']) throw new ApiError(400, 'VALIDATION_FAILED');
        const record = {
          id: backend.id('rec'),
          patientId: patient.id,
          authorUserId: role === 'doctor' ? DOCTOR_USER_ID : STAFF_USER_ID,
          authorName: role === 'doctor' ? 'د. سارة حسن' : 'منى فتحي',
          visibleToPatient: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          ...body,
        } as unknown as MockRecord;
        p2().records.push(record);
        return record;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/records\/([^/]+)\/attachment$/,
      ({ params, role }) => {
        const record = recordOrThrow(params[0], role);
        record.attachmentUrl = attachmentPath(record.id);
        record.updatedAt = nowIso();
        return { attachmentUrl: record.attachmentUrl };
      },
    ],
    // Attachments are served through an authorized API path, not a public file URL.
    [
      'GET',
      /^\/dashboard\/records\/([^/]+)\/attachment$/,
      ({ params, role }) => {
        const record = recordOrThrow(params[0], role);
        if (!record.attachmentUrl) throw new ApiError(404, 'NOT_FOUND');
        return new Blob(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#0b6e6e"/></svg>',
          ],
          { type: 'image/svg+xml' },
        );
      },
    ],
    [
      'PUT',
      /^\/dashboard\/records\/([^/]+)$/,
      ({ params, body, role }) => {
        const record = recordOrThrow(params[0], role);
        Object.assign(record, body, { updatedAt: nowIso() });
        return record;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/records\/([^/]+)$/,
      ({ params, role }) => {
        const record = recordOrThrow(params[0], role);
        p2().records = p2().records.filter((r) => r.id !== record.id);
        return null;
      },
    ],

    // ---- reviews ----
    [
      'GET',
      /^\/dashboard\/reviews$/,
      (ctx) => {
        const doctorId = scopedDoctorId(ctx, ctx.query.get('doctorId'));
        const status = ctx.query.get('status');
        const rows = view(
          p2()
            .reviews.filter(
              (r) => (!doctorId || r.doctor.id === doctorId) && (!status || r.status === status),
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((r) => omit(r, 'patientId') as DashboardReview),
        );
        return backend.page(rows, ctx.query);
      },
    ],
    [
      'POST',
      /^\/dashboard\/reviews\/([^/]+)\/(hide|publish)$/,
      ({ params, role }) => {
        staffOnly(role);
        const review = p2().reviews.find((r) => r.id === params[0]);
        if (!review) throw new ApiError(404, 'NOT_FOUND');
        review.status = params[1] === 'hide' ? 'Hidden' : 'Published';
        return null;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/reviews\/([^/]+)\/reply$/,
      ({ params, body }) => {
        const review = p2().reviews.find((r) => r.id === params[0]);
        if (!review) throw new ApiError(404, 'NOT_FOUND');
        if (!String(body['reply'] ?? '').trim()) throw new ApiError(400, 'VALIDATION_FAILED');
        review.reply = String(body['reply']);
        review.repliedAt = nowIso();
        return null;
      },
    ],

    // ---- coupons ----
    [
      'GET',
      /^\/dashboard\/coupons$/,
      () => [...p2().coupons].sort((a, b) => b.validTo.localeCompare(a.validTo)),
    ],
    [
      'POST',
      /^\/dashboard\/coupons$/,
      ({ body }) => {
        const coupon: Coupon = {
          id: backend.id('cp'),
          clinicId: CLINIC_ID,
          redemptionsCount: 0,
          createdAt: nowIso(),
          ...couponBody(body),
        };
        p2().coupons.push(coupon);
        return coupon;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/coupons\/([^/]+)$/,
      ({ params, body }) => {
        const coupon = p2().coupons.find((c) => c.id === params[0]);
        if (!coupon) throw new ApiError(404, 'NOT_FOUND');
        Object.assign(coupon, couponBody(body, coupon.id));
        return coupon;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/coupons\/([^/]+)$/,
      ({ params }) => {
        if (!p2().coupons.some((c) => c.id === params[0])) throw new ApiError(404, 'NOT_FOUND');
        p2().coupons = p2().coupons.filter((c) => c.id !== params[0]);
        return null;
      },
    ],
    [
      'GET',
      /^\/dashboard\/coupons\/([^/]+)\/redemptions$/,
      ({ params }) => {
        if (!p2().coupons.some((c) => c.id === params[0])) throw new ApiError(404, 'NOT_FOUND');
        return p2()
          .redemptions.filter((r) => r.couponId === params[0])
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
    ],

    // ---- recall campaigns ----
    ['GET', /^\/dashboard\/recall-campaigns$/, () => p2().campaigns],
    [
      'POST',
      /^\/dashboard\/recall-campaigns$/,
      ({ body }) => {
        if (!body['name'] || !body['messageAr'] || !body['messageEn'])
          throw new ApiError(400, 'VALIDATION_FAILED');
        const campaign = {
          id: backend.id('rc'),
          clinicId: CLINIC_ID,
          lastRunAt: null,
          createdAt: nowIso(),
          ...body,
        } as RecallCampaign;
        p2().campaigns.push(campaign);
        return campaign;
      },
    ],
    [
      'PUT',
      /^\/dashboard\/recall-campaigns\/([^/]+)$/,
      ({ params, body }) => {
        const campaign = p2().campaigns.find((c) => c.id === params[0]);
        if (!campaign) throw new ApiError(404, 'NOT_FOUND');
        Object.assign(campaign, body);
        return campaign;
      },
    ],
    [
      'DELETE',
      /^\/dashboard\/recall-campaigns\/([^/]+)$/,
      ({ params }) => {
        if (!p2().campaigns.some((c) => c.id === params[0])) throw new ApiError(404, 'NOT_FOUND');
        p2().campaigns = p2().campaigns.filter((c) => c.id !== params[0]);
        return null;
      },
    ],
    [
      'POST',
      /^\/dashboard\/recall-campaigns\/([^/]+)\/preview$/,
      ({ params }): RecallPreview => {
        const campaign = p2().campaigns.find((c) => c.id === params[0]);
        if (!campaign) throw new ApiError(404, 'NOT_FOUND');
        const audience = audienceOf(campaign);
        return {
          audienceCount: audience.length,
          sample: audience
            .slice(0, 5)
            .map((a) => ({ name: a.name, phone: a.phone, lastVisitAt: a.lastVisitAt })),
        };
      },
    ],
    [
      'POST',
      /^\/dashboard\/recall-campaigns\/([^/]+)\/send-now$/,
      ({ params }) => {
        const campaign = p2().campaigns.find((c) => c.id === params[0]);
        if (!campaign) throw new ApiError(404, 'NOT_FOUND');
        let sent = 0;
        let skipped = 0;
        const channel = campaign.channel === 'Auto' ? 'WhatsApp' : campaign.channel;
        for (const person of audienceOf(campaign)) {
          const recent = p2().sends.some(
            (s) =>
              s.campaignId === campaign.id &&
              s.patientUserId === person.id &&
              DateTime.fromISO(s.sentAt) > DateTime.now().minus({ days: 30 }),
          );
          const status = recent ? 'Skipped' : 'Sent';
          p2().sends.unshift({
            id: backend.id('rs'),
            campaignId: campaign.id,
            patientUserId: person.id,
            patientName: person.name,
            channel,
            status,
            sentAt: nowIso(),
          });
          if (recent) skipped++;
          else {
            sent++;
            addMessage(
              person.phone,
              'recall',
              ar() ? campaign.messageAr : campaign.messageEn,
              channel,
            );
          }
        }
        campaign.lastRunAt = nowIso();
        return { sent, failed: 0, skipped };
      },
    ],
    [
      'GET',
      /^\/dashboard\/recall-campaigns\/([^/]+)\/sends$/,
      ({ params, query }) =>
        backend.page(
          p2()
            .sends.filter((s) => s.campaignId === params[0])
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
          query,
        ),
    ],

    // ---- reports ----
    [
      'GET',
      /^\/dashboard\/reports\/bookings$/,
      ({ query, role }) => {
        const { report, format } = bookingsReport(query, role);
        return format === 'csv'
          ? csv(
              ['period', 'booked', 'completed', 'cancelled', 'noShow'],
              report.series.map((s) => [s.period, s.booked, s.completed, s.cancelled, s.noShow]),
            )
          : report;
      },
    ],
    [
      'GET',
      /^\/dashboard\/reports\/revenue$/,
      ({ query, role }) => {
        const { report, format } = revenueReport(query, role);
        return format === 'csv'
          ? csv(
              ['period', 'expectedEgp', 'collectedEgp'],
              report.series.map((s) => [s.period, s.expectedEgp, s.collectedEgp]),
            )
          : report;
      },
    ],

    // ---- messages ----
    [
      'GET',
      /^\/dashboard\/messages$/,
      ({ query }) => {
        const channel = query.get('channel');
        const from = query.get('from');
        const to = query.get('to');
        return backend.page(
          p2().messages.filter(
            (m) =>
              (!channel || m.channel === channel) &&
              (!from || localDay(m.createdAt) >= from) &&
              (!to || localDay(m.createdAt) <= to),
          ),
          query,
        );
      },
    ],
  ];

  /** Patients whose last visit is old enough, with no upcoming appointment, who accept marketing. */
  function audienceOf(campaign: RecallCampaign) {
    const cutoff = DateTime.now().minus({ months: campaign.monthsSinceLastVisit });
    return backend.state.patients
      .map((p) => {
        const mine = apptsOfPatient(p.id).map((a) => ({
          a,
          slot: backend.state.slots.find((s) => s.id === a.slotId)!,
        }));
        const completed = mine.filter(
          (x) =>
            x.a.status === 'Completed' &&
            (!campaign.doctorId || x.slot.doctorId === campaign.doctorId) &&
            (!campaign.serviceId || x.a.serviceId === campaign.serviceId),
        );
        const last =
          completed
            .map((x) => x.slot.startsAt)
            .sort()
            .at(-1) ?? null;
        const upcoming = mine.some(
          (x) => x.a.status === 'Confirmed' && DateTime.fromISO(x.slot.startsAt) > DateTime.now(),
        );
        return { id: p.id, name: p.fullName, phone: p.phone, lastVisitAt: last, upcoming };
      })
      .filter((p) => p.lastVisitAt && DateTime.fromISO(p.lastVisitAt) <= cutoff && !p.upcoming);
  }
}
