import { DateTime } from 'luxon';

import { attachmentPath } from './mock-core';
import { AppointmentStatus, AppointmentMode, InsuranceStatus, PaymentStatus } from '../api/models';
import {
  Coupon,
  CouponRedemption,
  DashboardPayment,
  DashboardReview,
  FamilyMember,
  Holiday,
  InsuranceProvider,
  MedicalInfo,
  OutboundMessage,
  RecallCampaign,
  RecallSend,
  RecordEntry,
  WaitingListEntry,
  WorkingHoursTemplate,
} from '../api/phase2.models';

/** Phase 2 fixtures for the demo build: Egyptian sample data for all thirteen features. */

export interface MockFamilyMember extends FamilyMember {
  ownerId: string;
}

export interface MockRecord extends RecordEntry {
  patientId: string;
}

export interface MockApptExtra {
  mode?: AppointmentMode;
  familyMemberId?: string;
  discountEgp?: number;
  couponId?: string;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
  insurance?: { providerId: string; memberNumber: string; status: InsuranceStatus; note?: string };
  review?: { rating: number; comment: string };
}

export interface Phase2State {
  holidays: Holiday[];
  templates: WorkingHoursTemplate[];
  waiting: (WaitingListEntry & { doctorId: string; patientId: string })[];
  payments: DashboardPayment[];
  insuranceProviders: InsuranceProvider[];
  /** doctor id to accepted insurance provider ids */
  doctorInsurance: Record<string, string[]>;
  familyMembers: MockFamilyMember[];
  /** `${patientId}|${familyMemberId or ''}` */
  medical: Record<string, MedicalInfo>;
  records: MockRecord[];
  reviews: (DashboardReview & { patientId: string })[];
  coupons: Coupon[];
  redemptions: (CouponRedemption & { couponId: string })[];
  campaigns: RecallCampaign[];
  sends: (RecallSend & { campaignId: string })[];
  messages: OutboundMessage[];
  extras: Record<string, MockApptExtra>;
}

export interface SeedInput {
  now: DateTime;
  tz: string;
  clinicId: string;
  appointments: {
    id: string;
    slotId: string;
    patientId: string;
    serviceId: string | null;
    status: AppointmentStatus;
  }[];
  slots: { id: string; doctorId: string; startsAt: string }[];
  patients: { id: string; fullName: string; phone: string }[];
  services: { id: string; priceEgp?: number | null }[];
}

/** Egyptian public holidays with a fixed date (month-day), name Arabic, name English. */
export const EGYPT_FIXED_HOLIDAYS: [string, string, string][] = [
  ['01-07', 'عيد الميلاد المجيد', 'Coptic Christmas'],
  ['01-25', 'عيد الثورة وعيد الشرطة', 'Revolution Day and Police Day'],
  ['04-25', 'عيد تحرير سيناء', 'Sinai Liberation Day'],
  ['05-01', 'عيد العمال', 'Labour Day'],
  ['06-30', 'ذكرى ثورة 30 يونيو', '30 June Revolution'],
  ['07-23', 'ذكرى ثورة 23 يوليو', '23 July Revolution'],
  ['10-06', 'عيد القوات المسلحة', 'Armed Forces Day'],
];

/** Moveable holidays (approximate dates, enough for the demo). */
export const EGYPT_MOVEABLE_HOLIDAYS: Record<number, [string, string, string][]> = {
  2026: [
    ['03-20', 'عيد الفطر المبارك', 'Eid al-Fitr'],
    ['03-21', 'ثاني أيام عيد الفطر', 'Eid al-Fitr (day 2)'],
    ['04-12', 'عيد القيامة المجيد', 'Coptic Easter'],
    ['04-13', 'شم النسيم', 'Sham El-Nessim'],
    ['05-26', 'وقفة عرفات', 'Arafat Day'],
    ['05-27', 'عيد الأضحى المبارك', 'Eid al-Adha'],
    ['05-28', 'ثاني أيام عيد الأضحى', 'Eid al-Adha (day 2)'],
    ['06-16', 'رأس السنة الهجرية', 'Islamic New Year'],
    ['08-25', 'المولد النبوي الشريف', "Prophet's Birthday"],
  ],
  2027: [
    ['03-10', 'عيد الفطر المبارك', 'Eid al-Fitr'],
    ['04-30', 'عيد القيامة المجيد', 'Coptic Easter'],
    ['05-01', 'شم النسيم', 'Sham El-Nessim'],
    ['05-16', 'عيد الأضحى المبارك', 'Eid al-Adha'],
    ['08-14', 'المولد النبوي الشريف', "Prophet's Birthday"],
  ],
  2028: [
    ['02-26', 'عيد الفطر المبارك', 'Eid al-Fitr'],
    ['04-16', 'عيد القيامة المجيد', 'Coptic Easter'],
    ['04-17', 'شم النسيم', 'Sham El-Nessim'],
    ['05-05', 'عيد الأضحى المبارك', 'Eid al-Adha'],
  ],
};

const INSURANCE: InsuranceProvider[] = [
  { id: 'ins-misr', nameAr: 'مصر للتأمين', nameEn: 'Misr Insurance', isActive: true },
  { id: 'ins-allianz', nameAr: 'أليانز مصر', nameEn: 'Allianz Egypt', isActive: true },
  { id: 'ins-bupa', nameAr: 'بوبا مصر', nameEn: 'Bupa Egypt', isActive: true },
  { id: 'ins-globemed', nameAr: 'جلوب ميد مصر', nameEn: 'GlobeMed Egypt', isActive: true },
  { id: 'ins-medright', nameAr: 'ميد رايت', nameEn: 'MedRight', isActive: false },
];

export function holidayId(clinicId: string, date: string): string {
  return `hol-${clinicId}-${date}`;
}

export function seedPhase2(input: SeedInput): Phase2State {
  const { now, tz, clinicId } = input;
  const today = now.setZone(tz).startOf('day');
  const at = (days: number, hour = 9, minute = 0) =>
    today.plus({ days, hours: hour, minutes: minute }).toUTC().toISO()!;
  const dayKey = (days: number) => today.plus({ days }).toFormat('yyyy-MM-dd');
  const slotOf = (appointmentId: string) =>
    input.slots.find(
      (s) => s.id === input.appointments.find((a) => a.id === appointmentId)?.slotId,
    );

  // ---- holidays: this year's fixed ones plus a clinic day off in the demo window ----
  const year = today.year;
  const holidays: Holiday[] = [];
  for (const [md, nameAr, nameEn] of [
    ...EGYPT_FIXED_HOLIDAYS,
    ...(EGYPT_MOVEABLE_HOLIDAYS[year] ?? []),
  ]) {
    const date = `${year}-${md}`;
    holidays.push({
      id: holidayId(clinicId, date),
      clinicId,
      date,
      nameAr,
      nameEn,
      source: 'EgyptPublic',
    });
  }
  holidays.push({
    id: 'hol-manual-1',
    clinicId,
    date: dayKey(3),
    nameAr: 'يوم صيانة وتجديد العيادة',
    nameEn: 'Clinic renovation day',
    source: 'Manual',
  });

  // ---- working-hours templates ----
  const week = (days: string[], start: string, end: string) =>
    days.map((dayOfWeek) => ({ dayOfWeek: dayOfWeek as 'Sunday', start, end }));
  const templates: WorkingHoursTemplate[] = [
    {
      id: 'wht-1',
      clinicId,
      name: 'الدوام الصباحي (الأحد - الخميس)',
      slotMinutes: 30,
      rules: week(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], '09:00', '14:00'),
    },
    {
      id: 'wht-2',
      clinicId,
      name: 'دوام مسائي (السبت والاثنين والأربعاء)',
      slotMinutes: 45,
      rules: week(['Saturday', 'Monday', 'Wednesday'], '17:00', '21:00'),
    },
  ];

  // ---- family ----
  const familyMembers: MockFamilyMember[] = [
    {
      id: 'fm-1',
      ownerId: 'pt-5',
      fullName: 'آدم محمود',
      relation: 'Child',
      dateOfBirth: '2019-04-12',
      gender: 'Male',
    },
    {
      id: 'fm-2',
      ownerId: 'pt-1',
      fullName: 'سلمى حسن',
      relation: 'Spouse',
      dateOfBirth: '1990-09-03',
      gender: 'Female',
    },
    {
      id: 'fm-3',
      ownerId: 'pt-1',
      fullName: 'مصطفى كمال',
      relation: 'Parent',
      dateOfBirth: '1958-01-20',
      gender: 'Male',
    },
  ];

  // ---- appointment extras (the rest of the appointment fixtures stay as they were) ----
  const extras: Record<string, MockApptExtra> = {
    'apt-1': {
      paymentStatus: 'Paid',
      paymentId: 'pay-1',
      review: { rating: 5, comment: 'دكتورة ممتازة وتعامل راقٍ جدًا، لم أشعر بأي ألم.' },
    },
    'apt-3': {
      insurance: { providerId: 'ins-bupa', memberNumber: 'BUP-4417-2290', status: 'Pending' },
    },
    'apt-4': {
      insurance: {
        providerId: 'ins-misr',
        memberNumber: 'MIS-880142',
        status: 'Approved',
        note: 'تغطية 80% من قيمة الخدمة',
      },
    },
    'apt-5': { familyMemberId: 'fm-1', paymentStatus: 'Paid', paymentId: 'pay-2' },
    'apt-6': { paymentStatus: 'Refunded', paymentId: 'pay-5' },
    'apt-7': {
      mode: 'Video',
      discountEgp: 45,
      couponId: 'cp-1',
      paymentStatus: 'Pending',
      paymentId: 'pay-6',
    },
    'apt-8': { paymentStatus: 'Paid', paymentId: 'pay-4' },
    'apt-9': { familyMemberId: 'fm-2', paymentStatus: 'Paid', paymentId: 'pay-3' },
    'apt-h1': {
      review: { rating: 4, comment: 'Good service, but I waited a while before being seen.' },
    },
    'apt-11': {
      insurance: {
        providerId: 'ins-allianz',
        memberNumber: 'ALZ-5531-07',
        status: 'Rejected',
        note: 'الخدمة غير مشمولة بالوثيقة',
      },
    },
  };

  // ---- payments ----
  const patientOf = (id: string) => input.patients.find((p) => p.id === id)!;
  const apptInfo = (appointmentId: string) => {
    // Some demo appointments fall on a Friday (no slots) and do not exist that week.
    const a = input.appointments.find((x) => x.id === appointmentId);
    const slot = slotOf(appointmentId);
    if (!a || !slot) return null;
    const service = input.services.find((s) => s.id === a.serviceId);
    return { a, slot, price: service?.priceEgp ?? 300 };
  };
  const mkPayment = (
    id: string,
    appointmentId: string,
    status: DashboardPayment['status'],
    method: DashboardPayment['method'],
    amount?: number,
  ): DashboardPayment | null => {
    const info = apptInfo(appointmentId);
    if (!info) return null;
    const { a, slot, price } = info;
    const start = DateTime.fromISO(slot.startsAt);
    // Payments happen before the visit but never in the future.
    const created = DateTime.min(start.minus({ days: 1 }), now.minus({ hours: 5 }));
    const refunded = DateTime.min(start.minus({ hours: 4 }), now.minus({ hours: 1 }));
    const patient = patientOf(a.patientId);
    return {
      id,
      appointmentId,
      amountEgp: amount ?? price,
      status,
      method,
      provider: method === 'Online' ? 'Paymob' : 'Cash',
      providerRef: method === 'Online' ? `PMB-${id.toUpperCase()}-73${id.length}` : null,
      createdAt: created.toUTC().toISO()!,
      paidAt:
        status === 'Paid' || status === 'Refunded'
          ? start.minus({ hours: 20 }).toUTC().toISO()!
          : null,
      refundedAt: status === 'Refunded' ? refunded.toUTC().toISO()! : null,
      patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
      doctor: { id: slot.doctorId, name: '' },
      startsAt: slot.startsAt,
    };
  };
  const payments: DashboardPayment[] = (
    [
      mkPayment('pay-1', 'apt-1', 'Paid', 'Cash'),
      mkPayment('pay-2', 'apt-5', 'Paid', 'Online'),
      mkPayment('pay-3', 'apt-9', 'Paid', 'Online'),
      mkPayment('pay-4', 'apt-8', 'Paid', 'Online'),
      mkPayment('pay-5', 'apt-6', 'Refunded', 'Online'),
      mkPayment('pay-6', 'apt-7', 'Pending', 'Online', 255),
    ] as (DashboardPayment | null)[]
  ).filter((p): p is DashboardPayment => p !== null);

  // ---- waiting list ----
  const waiting: Phase2State['waiting'] = [
    {
      id: 'wl-1',
      patientId: 'pt-2',
      doctorId: 'doc-sara',
      patient: { id: 'pt-2', fullName: 'Nour El-Din Samir', phone: '+201112345678' },
      doctor: { id: 'doc-sara', name: '' },
      date: dayKey(1),
      status: 'Waiting',
      createdAt: at(-1, 11, 20),
    },
    {
      id: 'wl-2',
      patientId: 'pt-6',
      doctorId: 'doc-sara',
      patient: { id: 'pt-6', fullName: 'Youssef Adel', phone: '+201118765432' },
      doctor: { id: 'doc-sara', name: '' },
      date: dayKey(1),
      status: 'Notified',
      notifiedAt: at(0, 8, 5),
      createdAt: at(-2, 15, 40),
    },
    {
      id: 'wl-3',
      patientId: 'pt-3',
      doctorId: 'doc-omar',
      patient: { id: 'pt-3', fullName: 'ليلى إبراهيم', phone: '+201223456789' },
      doctor: { id: 'doc-omar', name: '' },
      date: dayKey(2),
      status: 'Waiting',
      createdAt: at(0, 7, 55),
    },
    {
      id: 'wl-4',
      patientId: 'pt-8',
      doctorId: 'doc-mona',
      patient: { id: 'pt-8', fullName: 'Tarek Hegazy', phone: '+201556543210' },
      doctor: { id: 'doc-mona', name: '' },
      familyMember: { id: 'fm-x', fullName: 'ياسين طارق', relation: 'Child' },
      date: dayKey(4),
      status: 'Waiting',
      createdAt: at(-1, 18, 10),
    },
    {
      id: 'wl-5',
      patientId: 'pt-4',
      doctorId: 'doc-sara',
      patient: { id: 'pt-4', fullName: 'Karim Fouad', phone: '+201554567890' },
      doctor: { id: 'doc-sara', name: '' },
      date: dayKey(0),
      status: 'Booked',
      notifiedAt: at(-1, 9, 0),
      createdAt: at(-3, 10, 0),
    },
  ];

  // ---- medical info and records ----
  const medical: Record<string, MedicalInfo> = {
    'pt-1|': {
      bloodType: 'O+',
      allergies: 'حساسية من البنسلين',
      chronicConditions: 'ضغط الدم',
      medications: 'أملوديبين 5 مجم',
      updatedAt: at(-20),
    },
    'pt-3|': {
      bloodType: 'A+',
      allergies: 'لا يوجد',
      chronicConditions: '',
      medications: '',
      updatedAt: at(-40),
    },
    'pt-5|fm-1': {
      bloodType: 'B+',
      allergies: 'حساسية من الفول السوداني',
      chronicConditions: '',
      medications: '',
      updatedAt: at(-10),
    },
  };
  const rec = (
    r: Omit<MockRecord, 'createdAt' | 'updatedAt'> & { daysAgo: number },
  ): MockRecord => {
    const { daysAgo, ...rest } = r;
    return { ...rest, createdAt: at(-daysAgo, 12), updatedAt: at(-daysAgo, 12) };
  };
  const records: MockRecord[] = [
    rec({
      id: 'rec-1',
      patientId: 'pt-1',
      familyMemberId: null,
      appointmentId: 'apt-1',
      doctorId: 'doc-sara',
      doctorName: 'د. سارة حسن',
      authorUserId: 'u-doc',
      authorName: 'د. سارة حسن',
      kind: 'Diagnosis',
      title: 'تسوس في الضرس السفلي الأيمن',
      body: 'تسوس متوسط العمق في الضرس رقم 46. يُنصح بحشو تجميلي خلال أسبوعين.',
      visibleToPatient: true,
      daysAgo: 0,
    }),
    rec({
      id: 'rec-2',
      patientId: 'pt-1',
      familyMemberId: null,
      doctorId: 'doc-sara',
      doctorName: 'د. سارة حسن',
      authorUserId: 'u-doc',
      authorName: 'د. سارة حسن',
      kind: 'Prescription',
      title: 'مضاد حيوي ومسكن',
      body: 'أموكسيسيللين 500 مجم كل 8 ساعات لمدة 5 أيام (يتم التأكد من الحساسية أولًا)\nإيبوبروفين 400 مجم عند اللزوم.',
      visibleToPatient: true,
      daysAgo: 14,
    }),
    rec({
      id: 'rec-3',
      patientId: 'pt-1',
      familyMemberId: null,
      doctorId: 'doc-sara',
      doctorName: 'د. سارة حسن',
      authorUserId: 'u-staff',
      authorName: 'منى فتحي',
      kind: 'Note',
      title: 'تفضيلات المريض',
      body: 'يفضل المواعيد الصباحية، ويتأخر أحيانًا بسبب الزحام.',
      visibleToPatient: false,
      daysAgo: 30,
    }),
    rec({
      id: 'rec-4',
      patientId: 'pt-1',
      familyMemberId: null,
      authorUserId: 'u-staff',
      authorName: 'منى فتحي',
      kind: 'Attachment',
      title: 'أشعة بانوراما',
      body: null,
      attachmentUrl: attachmentPath('rec-4'),
      visibleToPatient: false,
      daysAgo: 45,
    }),
    rec({
      id: 'rec-5',
      patientId: 'pt-5',
      familyMemberId: 'fm-1',
      doctorId: 'doc-mona',
      doctorName: 'د. منى عادل',
      authorUserId: 'u-staff',
      authorName: 'منى فتحي',
      kind: 'Note',
      title: 'أول زيارة لآدم',
      body: 'طفل متعاون، لا توجد حالات تسوس. تم إرشاد الأم لطريقة تنظيف الأسنان.',
      visibleToPatient: true,
      daysAgo: 7,
    }),
  ];

  // ---- reviews ----
  const reviews: Phase2State['reviews'] = [
    {
      id: 'rv-1',
      appointmentId: 'apt-1',
      patientId: 'pt-1',
      doctor: { id: 'doc-sara', name: '' },
      patientName: 'أحمد مصطفى',
      rating: 5,
      comment: 'دكتورة ممتازة وتعامل راقٍ جدًا، لم أشعر بأي ألم.',
      status: 'Published',
      reply: 'شكرًا لك أستاذ أحمد، سعداء بثقتك.',
      repliedAt: at(0, 15),
      createdAt: at(0, 13),
    },
    {
      id: 'rv-2',
      appointmentId: 'apt-h1',
      patientId: 'pt-2',
      doctor: { id: 'doc-sara', name: '' },
      patientName: 'Nour El-Din Samir',
      rating: 4,
      comment: 'Good service, but I waited a while before being seen.',
      status: 'Published',
      createdAt: at(-1, 16),
    },
    {
      id: 'rv-3',
      appointmentId: 'apt-x1',
      patientId: 'pt-2',
      doctor: { id: 'doc-omar', name: '' },
      patientName: 'Nour El-Din Samir',
      rating: 2,
      comment: 'Waited more than 40 minutes past my appointment time.',
      status: 'Published',
      createdAt: at(-3, 14),
    },
    {
      id: 'rv-4',
      appointmentId: 'apt-x2',
      patientId: 'pt-6',
      doctor: { id: 'doc-omar', name: '' },
      patientName: 'Youssef Adel',
      rating: 1,
      comment: 'كلام غير لائق تم حذفه من قبل الإدارة.',
      status: 'Hidden',
      createdAt: at(-5, 10),
    },
    {
      id: 'rv-5',
      appointmentId: 'apt-x3',
      patientId: 'pt-7',
      doctor: { id: 'doc-mona', name: '' },
      patientName: 'مريم سعيد',
      rating: 5,
      comment: 'ابني كان خايف جدًا والدكتورة منى اتعاملت معاه بلطف، شكرًا ليها.',
      status: 'Published',
      createdAt: at(-6, 12),
    },
    {
      id: 'rv-6',
      appointmentId: 'apt-x4',
      patientId: 'pt-4',
      doctor: { id: 'doc-sara', name: '' },
      patientName: 'Karim Fouad',
      rating: 5,
      comment: null,
      status: 'Published',
      createdAt: at(-8, 9),
    },
  ];

  // ---- coupons ----
  const coupons: Coupon[] = [
    {
      id: 'cp-1',
      clinicId,
      code: 'WELCOME15',
      titleAr: 'خصم 15% للمرضى الجدد',
      titleEn: '15% off for new patients',
      descriptionAr: 'على أول زيارة في العيادة',
      descriptionEn: 'On your first visit',
      discountType: 'Percent',
      value: 15,
      maxDiscountEgp: 150,
      validFrom: dayKey(-60),
      validTo: dayKey(90),
      maxRedemptions: 200,
      perPatientLimit: 1,
      doctorId: null,
      serviceId: null,
      isPublic: true,
      isActive: true,
      redemptionsCount: 3,
      createdAt: at(-60),
    },
    {
      id: 'cp-2',
      clinicId,
      code: 'CLEAN100',
      titleAr: 'خصم 100 جنيه على تنظيف الأسنان',
      titleEn: 'EGP 100 off teeth cleaning',
      discountType: 'Fixed',
      value: 100,
      validFrom: dayKey(-10),
      validTo: dayKey(30),
      maxRedemptions: 50,
      perPatientLimit: 2,
      doctorId: 'doc-sara',
      serviceId: 'sv-2',
      isPublic: true,
      isActive: true,
      redemptionsCount: 1,
      createdAt: at(-10),
    },
    {
      id: 'cp-3',
      clinicId,
      code: 'EID25',
      titleAr: 'عرض العيد 25%',
      titleEn: 'Eid offer 25%',
      discountType: 'Percent',
      value: 25,
      maxDiscountEgp: 300,
      validFrom: dayKey(-200),
      validTo: dayKey(-150),
      maxRedemptions: null,
      perPatientLimit: 1,
      doctorId: null,
      serviceId: null,
      isPublic: false,
      isActive: false,
      redemptionsCount: 18,
      createdAt: at(-200),
    },
  ];
  const redemptions: Phase2State['redemptions'] = [
    {
      couponId: 'cp-1',
      appointmentId: 'apt-7',
      patientUserId: 'pt-7',
      patientName: 'مريم سعيد',
      discountEgp: 45,
      createdAt: at(-1, 17),
    },
    {
      couponId: 'cp-1',
      appointmentId: 'apt-y1',
      patientUserId: 'pt-2',
      patientName: 'Nour El-Din Samir',
      discountEgp: 67.5,
      createdAt: at(-9, 12),
    },
    {
      couponId: 'cp-1',
      appointmentId: 'apt-y2',
      patientUserId: 'pt-8',
      patientName: 'Tarek Hegazy',
      discountEgp: 52.5,
      createdAt: at(-20, 18),
    },
    {
      couponId: 'cp-2',
      appointmentId: 'apt-y3',
      patientUserId: 'pt-3',
      patientName: 'ليلى إبراهيم',
      discountEgp: 100,
      createdAt: at(-2, 11),
    },
  ];

  // ---- recall campaigns ----
  const campaigns: RecallCampaign[] = [
    {
      id: 'rc-1',
      clinicId,
      name: 'تذكير بالكشف الدوري (6 شهور)',
      messageAr:
        'أهلًا {name}، مر وقت منذ زيارتك الأخيرة لـ {clinic}. احجز كشفك الدوري مع {doctor} الآن: {link}',
      messageEn:
        'Hi {name}, it has been a while since your last visit to {clinic}. Book your check-up with {doctor}: {link}',
      channel: 'Auto',
      monthsSinceLastVisit: 6,
      doctorId: null,
      serviceId: null,
      mode: 'Recurring',
      isActive: true,
      lastRunAt: at(0, 10),
      createdAt: at(-90),
    },
    {
      id: 'rc-2',
      clinicId,
      name: 'عودة مرضى التقويم',
      messageAr: 'أهلًا {name}، حان موعد متابعة التقويم مع {doctor}. احجز موعدك: {link}',
      messageEn: 'Hi {name}, it is time for your braces follow-up with {doctor}: {link}',
      channel: 'WhatsApp',
      monthsSinceLastVisit: 2,
      doctorId: 'doc-omar',
      serviceId: null,
      mode: 'OneOff',
      isActive: true,
      lastRunAt: null,
      createdAt: at(-5),
    },
  ];
  const sends: Phase2State['sends'] = [
    {
      id: 'rs-1',
      campaignId: 'rc-1',
      patientUserId: 'pt-2',
      patientName: 'Nour El-Din Samir',
      channel: 'WhatsApp',
      status: 'Sent',
      sentAt: at(0, 10),
    },
    {
      id: 'rs-2',
      campaignId: 'rc-1',
      patientUserId: 'pt-6',
      patientName: 'Youssef Adel',
      channel: 'Sms',
      status: 'Sent',
      sentAt: at(0, 10),
    },
    {
      id: 'rs-3',
      campaignId: 'rc-1',
      patientUserId: 'pt-8',
      patientName: 'Tarek Hegazy',
      channel: 'Push',
      status: 'Failed',
      sentAt: at(0, 10),
    },
    {
      id: 'rs-4',
      campaignId: 'rc-1',
      patientUserId: 'pt-4',
      patientName: 'Karim Fouad',
      channel: 'WhatsApp',
      status: 'Skipped',
      sentAt: at(0, 10),
    },
    {
      id: 'rs-5',
      campaignId: 'rc-1',
      patientUserId: 'pt-7',
      patientName: 'مريم سعيد',
      channel: 'WhatsApp',
      status: 'Sent',
      sentAt: at(-1, 10),
    },
  ];

  // ---- messages log ----
  const msg = (
    id: string,
    channel: OutboundMessage['channel'],
    to: string,
    kind: string,
    body: string,
    daysAgo: number,
    hour: number,
    status: OutboundMessage['status'] = 'Sent',
    error: string | null = null,
  ): OutboundMessage => ({
    id,
    channel,
    to,
    kind,
    body,
    status,
    error,
    providerRef: status === 'Sent' ? `wamid.${id}` : null,
    createdAt: at(-daysAgo, hour, 12),
  });
  const messages: OutboundMessage[] = [
    msg(
      'm-1',
      'WhatsApp',
      '+201001234567',
      'appointment_reminder',
      'تذكير: موعدك مع د. سارة حسن غدًا الساعة 9:00 صباحًا في عيادة نور.',
      0,
      18,
    ),
    msg(
      'm-2',
      'WhatsApp',
      '+201223456789',
      'appointment_confirmation',
      'تم تأكيد موعدك مع د. عمر خالد اليوم الساعة 10:00 صباحًا.',
      0,
      9,
    ),
    msg(
      'm-3',
      'Sms',
      '+201554567890',
      'appointment_confirmation',
      'Your appointment with Dr. Sara Hassan is confirmed for 11:00 AM.',
      0,
      8,
    ),
    msg(
      'm-4',
      'Push',
      '+201009876543',
      'appointment_reminder',
      'موعدك مع د. منى عادل بعد ساعتين.',
      0,
      7,
    ),
    msg(
      'm-5',
      'WhatsApp',
      '+201112345678',
      'waiting_list',
      'توفر موعد مع د. سارة حسن يوم الغد. احجز الآن.',
      0,
      8,
      'Sent',
    ),
    msg(
      'm-6',
      'WhatsApp',
      '+201118765432',
      'recall',
      'أهلًا Youssef، مر وقت منذ زيارتك الأخيرة لعيادة نور. احجز كشفك الدوري.',
      0,
      10,
    ),
    msg(
      'm-7',
      'Sms',
      '+201556543210',
      'recall',
      'Hi Tarek, it has been a while since your last visit. Book your check-up.',
      0,
      10,
    ),
    msg(
      'm-8',
      'Push',
      '+201556543210',
      'recall',
      'نفتقدك! احجز كشفك الدوري الآن.',
      0,
      10,
      'Failed',
      'الجهاز غير مسجّل لاستقبال الإشعارات',
    ),
    msg(
      'm-9',
      'WhatsApp',
      '+201227654321',
      'appointment_confirmation',
      'تم تأكيد استشارة الفيديو مع د. سارة حسن غدًا الساعة 11:00 صباحًا.',
      1,
      17,
    ),
    msg(
      'm-10',
      'WhatsApp',
      '+201001234567',
      'review_request',
      'كيف كانت زيارتك لعيادة نور؟ قيّمها الآن.',
      1,
      13,
    ),
    msg(
      'm-11',
      'Sms',
      '+201223456789',
      'appointment_cancelled',
      'نعتذر، تم إلغاء موعدك بسبب ظرف طارئ للطبيب. يرجى إعادة الحجز.',
      2,
      11,
      'Failed',
      'رقم الهاتف غير صالح لاستقبال الرسائل',
    ),
    msg(
      'm-12',
      'WhatsApp',
      '+201009876543',
      'appointment_confirmation',
      'تم تأكيد موعد آدم مع د. منى عادل اليوم الساعة 12:00 ظهرًا.',
      3,
      20,
    ),
    msg(
      'm-13',
      'Push',
      '+201112345678',
      'appointment_reminder',
      'Reminder: your appointment is tomorrow at 9:30 AM.',
      3,
      18,
    ),
    msg(
      'm-14',
      'Sms',
      '+201118765432',
      'appointment_confirmation',
      'تم تأكيد موعدك مع د. عمر خالد.',
      4,
      12,
    ),
  ];

  return {
    holidays,
    templates,
    waiting,
    payments,
    insuranceProviders: structuredClone(INSURANCE),
    doctorInsurance: {
      'doc-sara': ['ins-misr', 'ins-allianz', 'ins-bupa'],
      'doc-omar': ['ins-bupa', 'ins-globemed'],
      'doc-mona': [],
    },
    familyMembers,
    medical,
    records,
    reviews,
    coupons,
    redemptions,
    campaigns,
    sends,
    messages: messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    extras,
  };
}
