import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor, Service, Specialty } from '../../core/api/models';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ToastService } from '../../core/http/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ServiceDialog } from './service-dialog';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Doctor profile editor (bio, specialty, fee, photo, publish toggle) with the services tab. */
@Component({
  selector: 'app-doctor-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatIcon,
    MatTabGroup,
    MatTab,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doctor-editor.html',
  styleUrl: './doctor-editor.scss',
})
export class DoctorEditor {
  private readonly api = inject(DoctorsApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  protected readonly languages = inject(LanguageService);

  /** Route parameter `:id`. */
  readonly id = input.required<string>();

  protected readonly doctor = signal<Doctor | null>(null);
  protected readonly specialties = signal<Specialty[]>([]);
  protected readonly services = signal<Service[]>([]);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
    specialtyId: ['', Validators.required],
    bioAr: [''],
    bioEn: [''],
    yearsExperience: [null as number | null, [Validators.min(0), Validators.max(70)]],
    consultationFeeEgp: [null as number | null, Validators.min(0)],
    isPublished: [false],
  });

  constructor() {
    this.api.specialties().subscribe((s) => this.specialties.set(s));
    effect(() => {
      const id = this.id();
      this.api.get(id).subscribe((doctor) => this.applyDoctor(doctor));
      this.loadServices(id);
    });
  }

  private applyDoctor(doctor: Doctor): void {
    this.doctor.set(doctor);
    this.form.reset({
      nameAr: doctor.nameAr,
      nameEn: doctor.nameEn,
      specialtyId: doctor.specialtyId,
      bioAr: doctor.bioAr ?? '',
      bioEn: doctor.bioEn ?? '',
      yearsExperience: doctor.yearsExperience ?? null,
      consultationFeeEgp: doctor.consultationFeeEgp ?? null,
      isPublished: doctor.isPublished,
    });
  }

  protected title(): string {
    const d = this.doctor();
    return d ? localized(this.languages.language(), d.nameAr, d.nameEn) : '';
  }

  protected specialtyName(s: Specialty): string {
    return localized(this.languages.language(), s.nameAr, s.nameEn);
  }

  protected serviceName(s: Service): string {
    return localized(this.languages.language(), s.nameAr, s.nameEn);
  }

  // ---- profile ----

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .update(this.id(), {
        nameAr: v.nameAr.trim(),
        nameEn: v.nameEn.trim(),
        specialtyId: v.specialtyId,
        bioAr: v.bioAr.trim() || null,
        bioEn: v.bioEn.trim() || null,
        yearsExperience: v.yearsExperience === null ? null : Number(v.yearsExperience),
        consultationFeeEgp: v.consultationFeeEgp === null ? null : Number(v.consultationFeeEgp),
        isPublished: v.isPublished,
      })
      .subscribe({
        next: (doctor) => {
          this.saving.set(false);
          this.applyDoctor(doctor);
          this.toast.success('doctors.saved');
        },
        error: () => this.saving.set(false),
      });
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
      this.toast.failure('doctors.photoInvalid');
      return;
    }
    this.uploading.set(true);
    this.api.uploadPhoto(this.id(), file).subscribe({
      next: ({ photoUrl }) => {
        this.uploading.set(false);
        this.doctor.update((d) => (d ? { ...d, photoUrl } : d));
        this.toast.success('doctors.photoSaved');
      },
      error: () => this.uploading.set(false),
    });
  }

  // ---- services ----

  private loadServices(doctorId: string): void {
    this.api.services(doctorId).subscribe((services) => this.services.set(services));
  }

  protected openService(service?: Service): void {
    this.dialog
      .open(ServiceDialog, { data: { doctorId: this.id(), service } })
      .afterClosed()
      .pipe(filter((saved): saved is Service => !!saved))
      .subscribe(() => {
        this.toast.success('services.saved');
        this.loadServices(this.id());
      });
  }

  protected deactivate(service: Service): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'services.deleteTitle',
          messageKey: 'services.deleteMessage',
          messageParams: { name: this.serviceName(service) },
          confirmKey: 'services.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.deleteService(this.id(), service.id)),
      )
      .subscribe(() => {
        this.toast.success('services.deleted');
        this.loadServices(this.id());
      });
  }
}
