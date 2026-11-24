import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';

import { AdminApi } from '../../core/api/admin.api';
import { AdminClinicFeatures, Clinic, UpdateClinicFeaturesRequest } from '../../core/api/models';
import { ToastService } from '../../core/http/toast.service';
import { localized } from '../../core/i18n/localized';
import { LanguageService } from '../../core/i18n/language.service';

/** Platform admin: per-clinic feature overrides plus the clinic's fixed deposit amount. */
@Component({
  selector: 'app-features-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatHint,
    MatLabel,
    MatInput,
    MatIcon,
    MatProgressBar,
    MatSlideToggle,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ name() }}</h2>
    <mat-dialog-content>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'adminFeatures.deposit' | translate }}</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="any"
            [(ngModel)]="deposit"
            (ngModelChange)="depositCleared = false"
            dir="ltr"
          />
          <mat-hint>{{ 'adminFeatures.depositHint' | translate }}</mat-hint>
        </mat-form-field>
        <button
          mat-stroked-button
          type="button"
          class="clear-deposit"
          [disabled]="deposit === null"
          (click)="clearDeposit()"
        >
          <mat-icon>backspace</mat-icon>{{ 'adminFeatures.clearDeposit' | translate }}
        </button>

        <ul class="flags">
          @for (key of keys(); track key) {
            <li>
              <div class="flag-label">
                <span>{{ 'adminFeatures.keys.' + key | translate }}</span>
                @if (overridden()[key] && !resetKeys().has(key)) {
                  <span class="chip">{{ 'adminFeatures.overridden' | translate }}</span>
                }
                @if (resetKeys().has(key)) {
                  <span class="chip reset">{{ 'adminFeatures.defaultChip' | translate }}</span>
                }
              </div>
              <span class="flag-actions">
                @if (resetKeys().has(key)) {
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="'adminFeatures.undoReset' | translate"
                    (click)="undoReset(key)"
                  >
                    <mat-icon>undo</mat-icon>
                  </button>
                } @else {
                  @if (overridden()[key]) {
                    <button
                      mat-icon-button
                      type="button"
                      [attr.aria-label]="'adminFeatures.resetToDefault' | translate"
                      (click)="reset(key)"
                    >
                      <mat-icon>restart_alt</mat-icon>
                    </button>
                  }
                  <mat-slide-toggle
                    [ngModel]="values()[key]"
                    (ngModelChange)="set(key, $event)"
                    [attr.aria-label]="'adminFeatures.keys.' + key | translate"
                  />
                }
              </span>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ 'common.cancel' | translate }}
      </button>
      <button mat-flat-button type="button" [disabled]="loading() || saving()" (click)="save()">
        {{ 'common.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 22rem;
    }
    .clear-deposit {
      margin-bottom: 1rem;
    }
    .flags {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .flags li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .flag-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .flag-actions {
      display: inline-flex;
      align-items: center;
    }
    .chip {
      font-size: 0.75rem;
      padding: 0 0.5rem;
      border-radius: 1rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .chip.reset {
      background: var(--mat-sys-surface-variant);
    }
  `,
})
export class FeaturesDialog {
  protected readonly data = inject<{ clinic: Clinic }>(MAT_DIALOG_DATA);
  private readonly languages = inject(LanguageService);
  private readonly ref = inject(MatDialogRef<FeaturesDialog>);
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly keys = signal<string[]>([]);
  protected readonly values = signal<Record<string, boolean>>({});
  protected readonly overridden = signal<Record<string, boolean>>({});
  protected readonly resetKeys = signal<ReadonlySet<string>>(new Set());
  protected deposit: number | null = null;
  protected depositCleared = false;
  private initial: Record<string, boolean> = {};
  private initialDeposit: number | null = null;

  constructor() {
    this.api.clinicFeatures(this.data.clinic.id).subscribe((f: AdminClinicFeatures) => {
      const keys = Object.keys(f.features);
      const values: Record<string, boolean> = {};
      const overridden: Record<string, boolean> = {};
      for (const key of keys) {
        values[key] = f.features[key].effective;
        overridden[key] = f.features[key].hasOverride;
      }
      this.keys.set(keys);
      this.values.set(values);
      this.overridden.set(overridden);
      this.initial = { ...values };
      this.deposit = f.depositAmountEgp ?? null;
      this.initialDeposit = this.deposit;
      this.loading.set(false);
    });
  }

  protected name(): string {
    return localized(this.languages.language(), this.data.clinic.nameAr, this.data.clinic.nameEn);
  }

  protected set(key: string, on: boolean): void {
    this.values.update((v) => ({ ...v, [key]: on }));
  }

  protected reset(key: string): void {
    this.resetKeys.update((set) => new Set(set).add(key));
  }

  protected undoReset(key: string): void {
    this.resetKeys.update((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  protected clearDeposit(): void {
    this.deposit = null;
    this.depositCleared = true;
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const features: Record<string, boolean | null> = {};
    for (const key of this.keys()) {
      if (this.resetKeys().has(key)) {
        features[key] = null;
      } else if (this.values()[key] !== this.initial[key]) {
        features[key] = this.values()[key];
      }
    }
    const body: UpdateClinicFeaturesRequest = {};
    if (Object.keys(features).length > 0) {
      body.features = features;
    }
    if (this.depositCleared) {
      body.clearDepositAmountEgp = true;
    } else if (this.deposit !== this.initialDeposit && this.deposit !== null) {
      body.depositAmountEgp = this.deposit;
    }
    this.saving.set(true);
    this.api.updateClinicFeatures(this.data.clinic.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('adminFeatures.saved');
        this.ref.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
