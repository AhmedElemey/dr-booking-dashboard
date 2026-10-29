import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { AdminApi } from '../../core/api/admin.api';
import { Clinic } from '../../core/api/models';

/** Admin: create a clinic. Closes with the created clinic. */
@Component({
  selector: 'app-clinic-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'admin.addClinic' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.nameAr' | translate }}</mat-label>
            <input matInput formControlName="nameAr" dir="rtl" />
            @if (form.controls.nameAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.nameEn' | translate }}</mat-label>
            <input matInput formControlName="nameEn" dir="ltr" />
            @if (form.controls.nameEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.addressAr' | translate }}</mat-label>
            <input matInput formControlName="addressAr" dir="rtl" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.addressEn' | translate }}</mat-label>
            <input matInput formControlName="addressEn" dir="ltr" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.city' | translate }}</mat-label>
            <input matInput formControlName="city" />
            @if (form.controls.city.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.phone' | translate }}</mat-label>
            <input matInput type="tel" formControlName="phone" dir="ltr" />
            @if (form.controls.phone.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ 'clinic.timezone' | translate }}</mat-label>
            <input matInput formControlName="timezone" dir="ltr" />
            <mat-hint>{{ 'admin.timezoneHint' | translate }}</mat-hint>
          </mat-form-field>
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
      min-inline-size: min(640px, 80vw);
      padding-block-start: 8px;
    }
  `,
})
export class ClinicDialog {
  private readonly api = inject(AdminApi);
  private readonly ref = inject<MatDialogRef<ClinicDialog, Clinic>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
    addressAr: [''],
    addressEn: [''],
    city: ['', Validators.required],
    phone: ['', Validators.required],
    timezone: ['Africa/Cairo', Validators.required],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .createClinic({
        nameAr: v.nameAr.trim(),
        nameEn: v.nameEn.trim(),
        addressAr: v.addressAr.trim(),
        addressEn: v.addressEn.trim(),
        city: v.city.trim(),
        phone: v.phone.trim(),
        timezone: v.timezone.trim(),
      })
      .subscribe({
        next: (clinic) => this.ref.close(clinic),
        error: () => this.saving.set(false),
      });
  }
}
