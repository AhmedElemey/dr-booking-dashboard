import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';

import { ClinicApi } from '../../core/api/clinic.api';
import { Clinic } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { FeaturesService } from '../../core/config/features.service';
import { ToastService } from '../../core/http/toast.service';
import { ClinicTime } from '../../core/time/clinic-time.service';

/** Clinic info: editable by staff, read-only for doctors. */
@Component({
  selector: 'app-clinic-settings',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatIcon,
    MatSlideToggle,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <div class="page-title">
        <h1>{{ 'clinic.title' | translate }}</h1>
      </div>

      @if (!canEdit()) {
        <p class="readonly muted"><mat-icon>lock</mat-icon>{{ 'clinic.readOnly' | translate }}</p>
      }

      <form class="panel box" [formGroup]="form" (ngSubmit)="save()" novalidate>
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
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.latitude' | translate }}</mat-label>
            <input matInput type="number" step="any" formControlName="latitude" dir="ltr" />
            @if (form.controls.latitude.invalid) {
              <mat-error>{{ 'validation.latitude' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'clinic.longitude' | translate }}</mat-label>
            <input matInput type="number" step="any" formControlName="longitude" dir="ltr" />
            @if (form.controls.longitude.invalid) {
              <mat-error>{{ 'validation.longitude' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ 'clinic.timezone' | translate }}</mat-label>
            <input matInput [value]="timezone()" readonly dir="ltr" />
            <mat-hint>{{ 'clinic.timezoneHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-slide-toggle class="full" formControlName="showPrices">{{
            'clinic.showPrices' | translate
          }}</mat-slide-toggle>
          @if (!pricesAllowed()) {
            <p class="full locked muted">
              <mat-icon>lock</mat-icon>{{ 'clinic.pricesLocked' | translate }}
            </p>
          }
        </div>

        @if (canEdit()) {
          <div class="row">
            <button mat-flat-button type="submit" [disabled]="saving()">
              {{ 'common.save' | translate }}
            </button>
          </div>
        }
      </form>
    </div>
  `,
  styles: `
    .narrow {
      max-inline-size: 860px;
    }
    .box {
      padding: 24px;
    }
    .readonly,
    .locked {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .row {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class ClinicSettings {
  private readonly api = inject(ClinicApi);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly clinicTime = inject(ClinicTime);
  private readonly features = inject(FeaturesService);

  protected readonly canEdit = computed(() => this.auth.role() === 'ClinicStaff');
  /** Super admin's publicPrices feature for this clinic; when off, the clinic's own switch is locked. */
  protected readonly pricesAllowed = computed(() => this.features.features().publicPrices);
  protected readonly saving = signal(false);
  protected readonly timezone = signal('Africa/Cairo');

  protected readonly form = this.fb.group({
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
    addressAr: [''],
    addressEn: [''],
    city: ['', Validators.required],
    phone: ['', Validators.required],
    showPrices: [true],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
  });

  constructor() {
    if (!this.canEdit()) this.form.disable();
    effect(() => {
      const control = this.form.controls.showPrices;
      if (!this.canEdit()) return;
      if (this.pricesAllowed()) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    });
    this.api.get().subscribe((clinic) => this.apply(clinic));
  }

  private apply(clinic: Clinic): void {
    this.timezone.set(clinic.timezone);
    this.form.reset({
      nameAr: clinic.nameAr,
      nameEn: clinic.nameEn,
      addressAr: clinic.addressAr ?? '',
      addressEn: clinic.addressEn ?? '',
      city: clinic.city,
      phone: clinic.phone,
      showPrices: clinic.showPrices,
      latitude: clinic.latitude ?? null,
      longitude: clinic.longitude ?? null,
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving() || !this.canEdit()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .update({
        nameAr: v.nameAr!.trim(),
        nameEn: v.nameEn!.trim(),
        addressAr: v.addressAr!.trim(),
        addressEn: v.addressEn!.trim(),
        city: v.city!.trim(),
        phone: v.phone!.trim(),
        showPrices: v.showPrices ?? true,
        latitude: v.latitude === null || v.latitude === ('' as unknown) ? null : Number(v.latitude),
        longitude:
          v.longitude === null || v.longitude === ('' as unknown) ? null : Number(v.longitude),
      })
      .subscribe({
        next: (clinic) => {
          this.saving.set(false);
          this.apply(clinic);
          this.clinicTime.timezone.set(clinic.timezone);
          this.toast.success('clinic.saved');
        },
        error: () => this.saving.set(false),
      });
  }
}
