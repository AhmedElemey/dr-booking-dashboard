import { DateTime } from 'luxon';

import { AppointmentStatus, Clinic, Doctor, Service, Slot } from '../api/models';
import { Phase2State, seedPhase2 } from './mock-data-phase2';

/** In-memory fixtures for the demo "mock" build: a Cairo clinic, 3 doctors, a week of slots. */

export const MOCK_TZ = 'Africa/Cairo';

export interface MockAppointment {
  id: string;
  slotId: string;
  patientId: string;
  serviceId: string | null;
  status: AppointmentStatus;
  patientNote: string | null;
  cancelledBy: 'Patient' | 'Clinic' | null;
  cancelReason: string | null;
  /** liveQueue: set while the patient is in the clinic. */
  checkedInAt: string | null;
  startedAt: string | null;
}

export interface MockPatient {
  id: string;
  fullName: string;
  phone: string;
}

export interface MockSpecialty {
  id: string;
  nameAr: string;
  nameEn: string;
}

export type MockService = Service & { doctorId: string };

export interface MockState {
  clinics: Clinic[];
  specialties: MockSpecialty[];
  doctors: Doctor[];
  services: MockService[];
  slots: Slot[];
  appointments: MockAppointment[];
  patients: MockPatient[];
  /** Phase 2 feature data (holidays, payments, reviews, ...). */
  p2: Phase2State;
}

export const CLINIC_ID = 'clinic-noor';

const specialties: MockSpecialty[] = [
  { id: 'sp-general', nameAr: 'طب الأسنان العام', nameEn: 'General Dentistry' },
  { id: 'sp-ortho', nameAr: 'تقويم الأسنان', nameEn: 'Orthodontics' },
  { id: 'sp-pedo', nameAr: 'أسنان الأطفال', nameEn: 'Pediatric Dentistry' },
  { id: 'sp-endo', nameAr: 'علاج الجذور', nameEn: 'Endodontics' },
  { id: 'sp-cosmetic', nameAr: 'تجميل الأسنان', nameEn: 'Cosmetic Dentistry' },
  { id: 'sp-surgery', nameAr: 'جراحة الفم', nameEn: 'Oral Surgery' },
];

const clinics: Clinic[] = [
  {
    id: CLINIC_ID,
    nameAr: 'عيادة نور لطب الأسنان',
    nameEn: 'Noor Dental Clinic',
    addressAr: '١٢ شارع عباس العقاد، مدينة نصر',
    addressEn: '12 Abbas El Akkad St, Nasr City',
    city: 'Cairo',
    latitude: 30.0561,
    longitude: 31.3301,
    phone: '+20223456789',
    timezone: MOCK_TZ,
    isActive: true,
  },
  {
    id: 'clinic-smile',
    nameAr: 'مركز الابتسامة',
    nameEn: 'Smile Center',
    addressAr: '٥ شارع الجمهورية، الإسكندرية',
    addressEn: '5 El Gomhoureya St, Alexandria',
    city: 'Alexandria',
    latitude: 31.2001,
    longitude: 29.9187,
    phone: '+20233456789',
    timezone: MOCK_TZ,
    isActive: true,
  },
  {
    id: 'clinic-delta',
    nameAr: 'عيادات الدلتا للأسنان',
    nameEn: 'Delta Dental Clinics',
    addressAr: 'شارع الجيش، المنصورة',
    addressEn: 'El Geish St, Mansoura',
    city: 'Mansoura',
    phone: '+20502345678',
    timezone: MOCK_TZ,
    isActive: false,
  },
];

const doctors: Doctor[] = [
  {
    id: 'doc-sara',
    clinicId: CLINIC_ID,
    specialtyId: 'sp-general',
    slug: 'sara-hassan',
    nameAr: 'د. سارة حسن',
    nameEn: 'Dr. Sara Hassan',
    bioAr: 'طبيبة أسنان عامة بخبرة تزيد عن عشر سنوات في الحشوات والتنظيف والكشف الدوري.',
    bioEn: 'General dentist with over ten years of experience in fillings, cleaning and check-ups.',
    yearsExperience: 11,
    consultationFeeEgp: 300,
    isPublished: true,
    offersVideo: true,
  },
  {
    id: 'doc-omar',
    clinicId: CLINIC_ID,
    specialtyId: 'sp-ortho',
    slug: 'omar-khaled',
    nameAr: 'د. عمر خالد',
    nameEn: 'Dr. Omar Khaled',
    bioAr: 'أخصائي تقويم الأسنان والتقويم الشفاف.',
    bioEn: 'Orthodontist specialising in braces and clear aligners.',
    yearsExperience: 8,
    consultationFeeEgp: 450,
    isPublished: true,
    offersVideo: false,
  },
  {
    id: 'doc-mona',
    clinicId: CLINIC_ID,
    specialtyId: 'sp-pedo',
    slug: 'mona-adel',
    nameAr: 'د. منى عادل',
    nameEn: 'Dr. Mona Adel',
    bioAr: 'متخصصة في أسنان الأطفال وتعامل لطيف مع الصغار.',
    bioEn: 'Pediatric dentist, gentle with the youngest patients.',
    yearsExperience: 6,
    consultationFeeEgp: 350,
    isPublished: false,
    offersVideo: false,
  },
];

const services: MockService[] = [
  {
    id: 'sv-1',
    doctorId: 'doc-sara',
    nameAr: 'كشف',
    nameEn: 'Check-up',
    durationMinutes: 30,
    priceEgp: 300,
    isActive: true,
  },
  {
    id: 'sv-2',
    doctorId: 'doc-sara',
    nameAr: 'تنظيف الأسنان',
    nameEn: 'Cleaning',
    durationMinutes: 30,
    priceEgp: 500,
    isActive: true,
  },
  {
    id: 'sv-3',
    doctorId: 'doc-sara',
    nameAr: 'حشو',
    nameEn: 'Filling',
    durationMinutes: 60,
    priceEgp: 800,
    isActive: true,
  },
  {
    id: 'sv-4',
    doctorId: 'doc-omar',
    nameAr: 'استشارة تقويم',
    nameEn: 'Braces consultation',
    durationMinutes: 30,
    priceEgp: 450,
    isActive: true,
  },
  {
    id: 'sv-5',
    doctorId: 'doc-omar',
    nameAr: 'ضبط التقويم',
    nameEn: 'Braces adjustment',
    durationMinutes: 30,
    priceEgp: 400,
    isActive: true,
  },
  {
    id: 'sv-6',
    doctorId: 'doc-mona',
    nameAr: 'كشف أطفال',
    nameEn: 'Child check-up',
    durationMinutes: 30,
    priceEgp: 350,
    isActive: true,
  },
];

const patients: MockPatient[] = [
  { id: 'pt-1', fullName: 'أحمد مصطفى', phone: '+201001234567' },
  { id: 'pt-2', fullName: 'Nour El-Din Samir', phone: '+201112345678' },
  { id: 'pt-3', fullName: 'ليلى إبراهيم', phone: '+201223456789' },
  { id: 'pt-4', fullName: 'Karim Fouad', phone: '+201554567890' },
  { id: 'pt-5', fullName: 'هبة عبد الله', phone: '+201009876543' },
  { id: 'pt-6', fullName: 'Youssef Adel', phone: '+201118765432' },
  { id: 'pt-7', fullName: 'مريم سعيد', phone: '+201227654321' },
  { id: 'pt-8', fullName: 'Tarek Hegazy', phone: '+201556543210' },
  { id: 'pt-9', fullName: 'سامح رمضان', phone: '+201007788990' },
  { id: 'pt-10', fullName: 'دينا شريف', phone: '+201116655443' },
  { id: 'pt-11', fullName: 'Omar Nabil', phone: '+201228899001' },
];

const SLOTS_PER_DAY = 10; // 09:00 - 14:00, 30 minutes each
const DAY_FROM = -2;
const DAY_TO = 9;

export function slotId(doctorIndex: number, day: number, index: number): string {
  return `slot-${doctorIndex}-${day}-${index}`;
}

function buildSlots(now: DateTime): Slot[] {
  const today = now.setZone(MOCK_TZ).startOf('day');
  const slots: Slot[] = [];
  doctors.forEach((doctor, d) => {
    for (let day = DAY_FROM; day <= DAY_TO; day++) {
      const date = today.plus({ days: day });
      if (date.weekday === 5) continue; // Friday off
      for (let i = 0; i < SLOTS_PER_DAY; i++) {
        const start = date.plus({ hours: 9, minutes: i * 30 });
        slots.push({
          id: slotId(d, day, i),
          doctorId: doctor.id,
          startsAt: start.toUTC().toISO()!,
          endsAt: start.plus({ minutes: 30 }).toUTC().toISO()!,
          status: 'Open',
        });
      }
    }
  });
  return slots;
}

/** [doctor index, day offset, slot index, patient index, status, service id, note] */
const APPOINTMENTS: [
  number,
  number,
  number,
  number,
  AppointmentStatus,
  string | null,
  string | null,
][] = [
  [0, 0, 0, 0, 'Completed', 'sv-1', null],
  [0, 0, 1, 1, 'NoShow', 'sv-2', null],
  [1, 0, 2, 2, 'Confirmed', 'sv-4', 'First visit, nervous about braces.'],
  [0, 0, 4, 3, 'Confirmed', 'sv-3', null],
  [2, 0, 6, 4, 'Confirmed', 'sv-6', 'Child, 6 years old.'],
  [1, 0, 5, 5, 'Cancelled', 'sv-5', null],
  [0, 1, 2, 6, 'Confirmed', 'sv-1', null],
  [2, 1, 1, 7, 'Confirmed', 'sv-6', null],
  [1, 2, 8, 0, 'Confirmed', 'sv-5', null],
  [0, -1, 2, 2, 'Completed', 'sv-2', null],
  [0, 3, 0, 3, 'Confirmed', 'sv-1', null],
  [1, -1, 1, 4, 'NoShow', 'sv-4', null],
  // liveQueue: one visit with the doctor and one checked-in patient, both today.
  [1, 0, 1, 9, 'InProgress', 'sv-3', null],
  [0, 0, 5, 10, 'CheckedIn', 'sv-2', null],
];

/** Old completed visits [doctor index, days ago, patient index, service id] for the recall demo. */
const HISTORIC: [number, number, number, string][] = [
  [0, 250, 1, 'sv-2'],
  [0, 215, 5, 'sv-1'],
  [1, 200, 8, 'sv-5'],
  [0, 330, 9, 'sv-3'],
  [0, 190, 10, 'sv-1'],
];

/** Slots (doctor index, day, slot index) that are blocked in the demo. */
const BLOCKED: [number, number, number][] = [
  [0, 1, 8],
  [0, 1, 9],
  [2, 2, 0],
  [2, 2, 1],
  [1, 3, 4],
];

export function createMockState(now: DateTime = DateTime.now()): MockState {
  const slots = buildSlots(now);
  const byId = new Map(slots.map((s) => [s.id, s]));

  const appointments: MockAppointment[] = [];
  APPOINTMENTS.forEach(([d, day, i, p, status, serviceId, note], n) => {
    const slot = byId.get(slotId(d, day, i));
    if (!slot) return; // that day falls on a Friday
    // A cancelled appointment frees its slot; everything else holds it.
    if (status === 'Cancelled') slot.status = 'Open';
    else slot.status = 'Reserved';
    appointments.push({
      id: `apt-${n + 1}`,
      slotId: slot.id,
      patientId: patients[p].id,
      serviceId,
      status,
      patientNote: note,
      cancelledBy: status === 'Cancelled' ? 'Patient' : null,
      cancelReason: status === 'Cancelled' ? 'Travelling that day' : null,
      checkedInAt:
        status === 'CheckedIn' || status === 'InProgress' ? slot.startsAt : null,
      startedAt: status === 'InProgress' ? slot.startsAt : null,
    });
  });

  HISTORIC.forEach(([d, daysAgo, p, serviceId], n) => {
    const start = now.setZone(MOCK_TZ).startOf('day').minus({ days: daysAgo }).plus({ hours: 10 });
    const slot: Slot = {
      id: `slot-h-${n}`,
      doctorId: doctors[d].id,
      startsAt: start.toUTC().toISO()!,
      endsAt: start.plus({ minutes: 30 }).toUTC().toISO()!,
      status: 'Reserved',
    };
    slots.push(slot);
    appointments.push({
      id: `apt-h${n + 1}`,
      slotId: slot.id,
      patientId: patients[p].id,
      serviceId,
      status: 'Completed',
      patientNote: null,
      cancelledBy: null,
      cancelReason: null,
      checkedInAt: null,
      startedAt: null,
    });
  });

  for (const [d, day, i] of BLOCKED) {
    const slot = byId.get(slotId(d, day, i));
    if (slot && slot.status === 'Open') slot.status = 'Blocked';
  }

  return {
    clinics: structuredClone(clinics),
    specialties: structuredClone(specialties),
    doctors: structuredClone(doctors),
    services: structuredClone(services),
    slots,
    appointments,
    patients: structuredClone(patients),
    p2: seedPhase2({
      now,
      tz: MOCK_TZ,
      clinicId: CLINIC_ID,
      appointments,
      slots,
      patients,
      services,
    }),
  };
}
