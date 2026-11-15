import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { CouponsApi } from '../../core/api/coupons.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { Coupon, CouponRedemption } from '../../core/api/phase2.models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { egp } from '../../core/util/format';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { CouponDialog } from './coupon-dialog';

/** Who used a coupon and what it saved them. */
@Component({
  selector: 'app-redemptions-dialog',
  imports: [MatDialogModule, MatButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'coupons.redemptionsTitle' | translate: { code: data.code } }}</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        @if (!loaded()) {
          <p class="muted">...</p>
        } @else if (rows().length === 0) {
          <p class="empty-state">{{ 'coupons.noRedemptions' | translate }}</p>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ 'payments.col.date' | translate }}</th>
                <th scope="col">{{ 'payments.col.patient' | translate }}</th>
                <th scope="col">{{ 'coupons.discount' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.appointmentId) {
                <tr>
                  <td>{{ clinicTime.date(r.createdAt) }}</td>
                  <td>{{ r.patientName || '-' }}</td>
                  <td class="num">{{ amount(r.discountEgp) }} {{ 'common.egp' | translate }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
})
export class RedemptionsDialog {
  protected readonly data = inject<Coupon>(MAT_DIALOG_DATA);
  private readonly api = inject(CouponsApi);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly rows = signal<CouponRedemption[]>([]);
  protected readonly loaded = signal(false);

  constructor() {
    this.api.redemptions(this.data.id).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  protected amount(v: number): string {
    return egp(v);
  }
}

/** promotions: discount codes with validity windows and limits. */
@Component({
  selector: 'app-coupons',
  imports: [MatButton, MatIconButton, MatIcon, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'coupons.title' | translate }}</h1>
        <button mat-flat-button type="button" (click)="open()">
          <mat-icon>add</mat-icon>{{ 'coupons.add' | translate }}
        </button>
      </div>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (coupons().length === 0 && !loading()) {
          <p class="empty-state">{{ 'coupons.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'coupons.code' | translate }}</th>
                  <th scope="col">{{ 'coupons.offer' | translate }}</th>
                  <th scope="col">{{ 'coupons.discount' | translate }}</th>
                  <th scope="col">{{ 'coupons.validity' | translate }}</th>
                  <th scope="col">{{ 'coupons.used' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (c of coupons(); track c.id) {
                  <tr [class.inactive]="!c.isActive">
                    <td>
                      <code class="code ltr-text">{{ c.code }}</code>
                    </td>
                    <td>
                      {{ title(c) }}
                      @if (c.isPublic) {
                        <span class="pill info">{{ 'coupons.public' | translate }}</span>
                      }
                    </td>
                    <td class="num">{{ discountLabel(c) }}</td>
                    <td class="num">
                      {{ clinicTime.keyLabel(c.validFrom.slice(0, 10), 'd LLL') }} -
                      {{ clinicTime.keyLabel(c.validTo.slice(0, 10), 'd LLL yyyy') }}
                    </td>
                    <td class="num">
                      {{ c.redemptionsCount }}{{ c.maxRedemptions ? ' / ' + c.maxRedemptions : '' }}
                    </td>
                    <td>
                      <span class="pill" [class.ok]="c.isActive">{{
                        (c.isActive ? 'coupons.isActive' : 'coupons.inactive') | translate
                      }}</span>
                    </td>
                    <td class="end">
                      <span class="row-actions">
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'coupons.redemptions' | translate"
                          (click)="showRedemptions(c)"
                        >
                          <mat-icon>receipt_long</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.edit' | translate"
                          (click)="open(c)"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.delete' | translate"
                          (click)="remove(c)"
                        >
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .code {
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  `,
})
export class Coupons {
  private readonly api = inject(CouponsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly coupons = signal<Coupon[]>([]);
  protected readonly loading = signal(true);
  private readonly doctors = signal<Doctor[]>([]);

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.coupons.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected title(c: Coupon): string {
    return localized(this.languages.language(), c.titleAr, c.titleEn);
  }

  protected discountLabel(c: Coupon): string {
    return c.discountType === 'Percent'
      ? `${c.value}%`
      : `${egp(c.value)} ${this.translate.instant('common.egp')}`;
  }

  protected open(coupon?: Coupon): void {
    this.dialog
      .open(CouponDialog, { data: { coupon, doctors: this.doctors() }, maxWidth: '96vw' })
      .afterClosed()
      .pipe(filter((saved): saved is Coupon => !!saved))
      .subscribe(() => {
        this.toast.success('coupons.saved');
        this.load();
      });
  }

  protected showRedemptions(coupon: Coupon): void {
    this.dialog.open(RedemptionsDialog, { data: coupon, maxWidth: '96vw' });
  }

  protected remove(coupon: Coupon): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'coupons.deleteTitle',
          messageKey: 'coupons.deleteMessage',
          messageParams: { code: coupon.code },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.delete(coupon.id)),
      )
      .subscribe(() => {
        this.toast.success('coupons.deleted');
        this.load();
      });
  }
}
