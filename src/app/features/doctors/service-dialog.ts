import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Service } from '../../core/api/models';

export interface ServiceDialogData {
  doctorId: string;
  service?: Service;
}

/** Create or edit a treatment type. Closes with the saved service. */
@Component({
  selector: 'app-service-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (data.service ? 'services.editTitle' : 'services.addTitle') | translate }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'services.nameAr' | translate }}</mat-label>
            <input matInput formControlName="nameAr" dir="rtl" />
            @if (form.controls.nameAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'services.nameEn' | translate }}</mat-label>
            <input matInput formControlName="nameEn" dir="ltr" />
            @if (form.controls.nameEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'services.duration' | translate }}</mat-label>
            <input
              matInput
              type="number"
              formControlName="durationMinutes"
              min="15"
              max="240"
              step="5"
            />
            @if (form.controls.durationMinutes.invalid) {
              <mat-error>{{ 'validation.durationRange' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'services.price' | translate }}</mat-label>
            <input matInput type="number" formControlName="priceEgp" min="0" />
            <span matTextSuffix>{{ 'common.egp' | translate }}</span>
          </mat-form-field>
          <mat-checkbox class="full" formControlName="isActive">
            {{ 'services.active' | translate }}
          </mat-checkbox>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ 'common.save' | translate }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form-grid {
      min-inline-size: min(520px, 80vw);
      padding-block-start: 8px;
    }
  `,
})
export class ServiceDialog {
  protected readonly data = inject<ServiceDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ServiceDialog, Service>>(MatDialogRef);
  private readonly api = inject(DoctorsApi);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    nameAr: [this.data.service?.nameAr ?? '', Validators.required],
    nameEn: [this.data.service?.nameEn ?? '', Validators.required],
    durationMinutes: [
      this.data.service?.durationMinutes ?? 30,
      [Validators.required, Validators.min(15), Validators.max(240)],
    ],
    priceEgp: [this.data.service?.priceEgp ?? (null as number | null)],
    isActive: [this.data.service?.isActive ?? true],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body = {
      nameAr: raw.nameAr!.trim(),
      nameEn: raw.nameEn!.trim(),
      durationMinutes: Number(raw.durationMinutes),
      priceEgp:
        raw.priceEgp === null || raw.priceEgp === ('' as unknown) ? null : Number(raw.priceEgp),
      isActive: !!raw.isActive,
    };
    this.saving.set(true);
    const request$ = this.data.service
      ? this.api.updateService(this.data.doctorId, this.data.service.id, body)
      : this.api.createService(this.data.doctorId, body);
    request$.subscribe({
      next: (service) => this.ref.close(service),
      error: () => this.saving.set(false),
    });
  }
}
