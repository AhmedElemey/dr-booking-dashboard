import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { CouponsApi } from '../../core/api/coupons.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor, Service } from '../../core/api/models';
import { Coupon, CouponRequest } from '../../core/api/phase2.models';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { numOrNull } from '../../core/util/format';
import { DateField } from '../../shared/date-field';

export const COUPON_CODE = /^[A-Z0-9-]{3,20}$/;

export interface CouponDialogData {
  coupon?: Coupon;
  doctors: Doctor[];
}

/** The window must end on or after the day it starts. */
export function validWindow(group: AbstractControl): ValidationErrors | null {
  const from = group.get('validFrom')?.value as string;
  const to = group.get('validTo')?.value as string;
  return from && to && to < from ? { window: true } : null;
}

/** Create or edit a coupon. Closes with the saved coupon. */
@Component({
  selector: 'app-coupon-dialog',
  imports: [
    DateField,
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
    <h2 mat-dialog-title>
      {{ (data.coupon ? 'coupons.editTitle' : 'coupons.addTitle') | translate }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid dialog-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.code' | translate }}</mat-label>
            <input
              matInput
              formControlName="code"
              dir="ltr"
              maxlength="20"
              autocapitalize="characters"
              (input)="upper()"
            />
            <mat-hint>{{ 'coupons.codeHint' | translate }}</mat-hint>
            @if (form.controls.code.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            } @else if (form.controls.code.hasError('pattern')) {
              <mat-error>{{ 'coupons.codeInvalid' | translate }}</mat-error>
            }
          </mat-form-field>
          <div></div>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.titleAr' | translate }}</mat-label>
            <input matInput formControlName="titleAr" dir="rtl" maxlength="120" />
            @if (form.controls.titleAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.titleEn' | translate }}</mat-label>
            <input matInput formControlName="titleEn" dir="ltr" maxlength="120" />
            @if (form.controls.titleEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.descriptionAr' | translate }}</mat-label>
            <textarea matInput rows="2" formControlName="descriptionAr" dir="rtl"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.descriptionEn' | translate }}</mat-label>
            <textarea matInput rows="2" formControlName="descriptionEn" dir="ltr"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.discountType' | translate }}</mat-label>
            <mat-select formControlName="discountType">
              <mat-option value="Percent">{{ 'coupons.types.Percent' | translate }}</mat-option>
              <mat-option value="Fixed">{{ 'coupons.types.Fixed' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.value' | translate }}</mat-label>
            <input matInput type="number" formControlName="value" min="1" />
            <span matTextSuffix>{{
              (form.controls.discountType.value === 'Percent'
                ? 'coupons.percentSign'
                : 'common.egp'
              ) | translate
            }}</span>
            @if (form.controls.value.invalid) {
              <mat-error>{{
                (form.controls.discountType.value === 'Percent'
                  ? 'coupons.percentRange'
                  : 'coupons.positive'
                ) | translate
              }}</mat-error>
            }
          </mat-form-field>
          @if (form.controls.discountType.value === 'Percent') {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'coupons.maxDiscount' | translate }}</mat-label>
              <input matInput type="number" formControlName="maxDiscountEgp" min="0" />
              <span matTextSuffix>{{ 'common.egp' | translate }}</span>
            </mat-form-field>
          }

          <app-date-field [label]="'coupons.validFrom' | translate" formControlName="validFrom" />
          <app-date-field
            [label]="'coupons.validTo' | translate"
            [error]="form.hasError('window') ? ('coupons.windowInvalid' | translate) : null"
            formControlName="validTo"
          />
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.maxRedemptions' | translate }}</mat-label>
            <input matInput type="number" formControlName="maxRedemptions" min="1" />
            <mat-hint>{{ 'coupons.unlimitedHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'coupons.perPatientLimit' | translate }}</mat-label>
            <input matInput type="number" formControlName="perPatientLimit" min="1" />
            @if (form.controls.perPatientLimit.invalid) {
              <mat-error>{{ 'coupons.positive' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select formControlName="doctorId" (selectionChange)="doctorChanged($event.value)">
              <mat-option value="">{{ 'coupons.anyDoctor' | translate }}</mat-option>
              @for (d of data.doctors; track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'newAppointment.service' | translate }}</mat-label>
            <mat-select formControlName="serviceId">
              <mat-option value="">{{ 'coupons.anyService' | translate }}</mat-option>
              @for (s of services(); track s.id) {
                <mat-option [value]="s.id">{{ serviceName(s) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-checkbox formControlName="isPublic">{{
            'coupons.isPublic' | translate
          }}</mat-checkbox>
          <mat-checkbox formControlName="isActive">{{
            'coupons.isActive' | translate
          }}</mat-checkbox>
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
})
export class CouponDialog {
  protected readonly data = inject<CouponDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CouponDialog, Coupon>>(MatDialogRef);
  private readonly api = inject(CouponsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly services = signal<Service[]>([]);

  protected readonly form = this.fb.nonNullable.group(
    {
      code: [this.data.coupon?.code ?? '', [Validators.required, Validators.pattern(COUPON_CODE)]],
      titleAr: [this.data.coupon?.titleAr ?? '', Validators.required],
      titleEn: [this.data.coupon?.titleEn ?? '', Validators.required],
      descriptionAr: [this.data.coupon?.descriptionAr ?? ''],
      descriptionEn: [this.data.coupon?.descriptionEn ?? ''],
      discountType: [this.data.coupon?.discountType ?? ('Percent' as Coupon['discountType'])],
      value: [
        this.data.coupon?.value ?? (10 as number),
        [Validators.required, Validators.min(0.01)],
      ],
      maxDiscountEgp: [this.data.coupon?.maxDiscountEgp ?? (null as number | null)],
      validFrom: [this.data.coupon?.validFrom?.slice(0, 10) ?? '', Validators.required],
      validTo: [this.data.coupon?.validTo?.slice(0, 10) ?? '', Validators.required],
      maxRedemptions: [this.data.coupon?.maxRedemptions ?? (null as number | null)],
      perPatientLimit: [
        this.data.coupon?.perPatientLimit ?? 1,
        [Validators.required, Validators.min(1)],
      ],
      doctorId: [this.data.coupon?.doctorId ?? ''],
      serviceId: [this.data.coupon?.serviceId ?? ''],
      isPublic: [this.data.coupon?.isPublic ?? true],
      isActive: [this.data.coupon?.isActive ?? true],
    },
    { validators: validWindow },
  );

  constructor() {
    // A percentage cannot exceed 100.
    this.form.controls.discountType.valueChanges.subscribe(() => this.applyValueRules());
    this.applyValueRules();
    if (this.data.coupon?.doctorId) this.doctorChanged(this.data.coupon.doctorId, true);
  }

  private applyValueRules(): void {
    const control = this.form.controls.value;
    const percent = this.form.controls.discountType.value === 'Percent';
    control.setValidators([
      Validators.required,
      Validators.min(percent ? 1 : 0.01),
      ...(percent ? [Validators.max(100)] : []),
    ]);
    control.updateValueAndValidity();
  }

  protected upper(): void {
    const control = this.form.controls.code;
    const value = control.value.toUpperCase();
    if (value !== control.value) control.setValue(value);
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected serviceName(s: Service): string {
    return localized(this.languages.language(), s.nameAr, s.nameEn);
  }

  protected doctorChanged(doctorId: string, keepService = false): void {
    if (!keepService) this.form.controls.serviceId.setValue('');
    this.services.set([]);
    if (doctorId) {
      this.doctorsApi
        .services(doctorId)
        .subscribe((list) => this.services.set(list.filter((s) => s.isActive)));
    }
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: CouponRequest = {
      code: v.code.trim().toUpperCase(),
      titleAr: v.titleAr.trim(),
      titleEn: v.titleEn.trim(),
      descriptionAr: v.descriptionAr.trim() || null,
      descriptionEn: v.descriptionEn.trim() || null,
      discountType: v.discountType,
      value: Number(v.value),
      maxDiscountEgp: v.discountType === 'Percent' ? numOrNull(v.maxDiscountEgp) : null,
      validFrom: v.validFrom,
      validTo: v.validTo,
      maxRedemptions: numOrNull(v.maxRedemptions),
      perPatientLimit: Number(v.perPatientLimit),
      doctorId: v.doctorId || null,
      serviceId: v.doctorId && v.serviceId ? v.serviceId : null,
      isPublic: v.isPublic,
      isActive: v.isActive,
    };
    this.saving.set(true);
    (this.data.coupon
      ? this.api.update(this.data.coupon.id, body)
      : this.api.create(body)
    ).subscribe({
      next: (coupon) => this.ref.close(coupon),
      error: () => this.saving.set(false),
    });
  }
}
