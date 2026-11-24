import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { AdminApi } from '../../core/api/admin.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { AdminUser, Specialty } from '../../core/api/models';
import { LanguageService } from '../../core/i18n/language.service';
import { egyptPhoneValidator, normalizeEgyptPhone } from '../../core/validators/phone';

export interface UserDialogData {
  clinicId: string;
  clinicName: string;
}

/** Admin: create a doctor or clinic-staff account for a clinic. Closes with the created user. */
@Component({
  selector: 'app-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'admin.addUser' | translate }} - {{ data.clinicName }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'admin.role' | translate }}</mat-label>
            <mat-select formControlName="role">
              <mat-option value="ClinicStaff">{{ 'roles.ClinicStaff' | translate }}</mat-option>
              <mat-option value="Doctor">{{ 'roles.Doctor' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'admin.fullName' | translate }}</mat-label>
            <input matInput formControlName="fullName" />
            @if (form.controls.fullName.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ 'login.phone' | translate }}</mat-label>
            <input
              matInput
              type="tel"
              formControlName="phone"
              dir="ltr"
              placeholder="01X XXXX XXXX"
            />
            <mat-hint>{{ 'login.phoneHint' | translate }}</mat-hint>
            @if (form.controls.phone.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            } @else if (form.controls.phone.hasError('egyptPhone')) {
              <mat-error>{{ 'validation.egyptPhone' | translate }}</mat-error>
            }
          </mat-form-field>

          @if (form.controls.role.value === 'ClinicStaff') {
            <mat-checkbox formControlName="isAdmin" class="full">
              {{ 'admin.clinicAdmin' | translate }}
            </mat-checkbox>
          }
          @if (form.controls.role.value === 'Doctor') {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'doctors.nameAr' | translate }}</mat-label>
              <input matInput formControlName="nameAr" dir="rtl" />
              @if (form.controls.nameAr.hasError('required')) {
                <mat-error>{{ 'validation.required' | translate }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'doctors.nameEn' | translate }}</mat-label>
              <input matInput formControlName="nameEn" dir="ltr" />
              @if (form.controls.nameEn.hasError('required')) {
                <mat-error>{{ 'validation.required' | translate }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>{{ 'doctors.specialty' | translate }}</mat-label>
              <mat-select formControlName="specialtyId">
                @for (s of specialties(); track s.id) {
                  <mat-option [value]="s.id">{{ specialtyName(s) }}</mat-option>
                }
              </mat-select>
              @if (form.controls.specialtyId.hasError('required')) {
                <mat-error>{{ 'validation.required' | translate }}</mat-error>
              }
            </mat-form-field>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ 'common.create' | translate }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form-grid {
      min-inline-size: min(560px, 80vw);
      padding-block-start: 8px;
    }
  `,
})
export class UserDialog {
  protected readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<UserDialog, AdminUser>>(MatDialogRef);
  private readonly admin = inject(AdminApi);
  private readonly doctors = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  protected readonly specialties = signal<Specialty[]>([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    role: ['ClinicStaff' as 'ClinicStaff' | 'Doctor'],
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, egyptPhoneValidator]],
    nameAr: [''],
    nameEn: [''],
    specialtyId: [''],
    isAdmin: [false],
  });

  constructor() {
    this.doctors.specialties().subscribe((s) => this.specialties.set(s));
    // Doctor-only fields become required only when the Doctor role is chosen.
    this.form.controls.role.valueChanges.subscribe((role) => {
      for (const name of ['nameAr', 'nameEn', 'specialtyId'] as const) {
        const control = this.form.controls[name];
        if (role === 'Doctor') control.addValidators(Validators.required);
        else control.removeValidators(Validators.required);
        control.updateValueAndValidity();
      }
    });
  }

  protected specialtyName(s: Specialty): string {
    return s.name;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.admin
      .createUser(this.data.clinicId, {
        phone: normalizeEgyptPhone(v.phone)!,
        fullName: v.fullName.trim(),
        role: v.role,
        ...(v.role === 'Doctor'
          ? { nameAr: v.nameAr.trim(), nameEn: v.nameEn.trim(), specialtyId: v.specialtyId }
          : { isAdmin: v.isAdmin }),
      })
      .subscribe({
        next: (user) => this.ref.close(user),
        error: () => this.saving.set(false), // PHONE_IN_USE etc. are toasted globally
      });
  }
}
