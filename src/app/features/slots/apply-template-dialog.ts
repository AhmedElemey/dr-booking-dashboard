import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { BulkSlotsResult } from '../../core/api/models';
import { WorkingHoursTemplate } from '../../core/api/phase2.models';
import { WorkingHoursApi } from '../../core/api/working-hours.api';
import { addDays, diffDays } from '../../core/time/clinic-time';

export interface ApplyTemplateData {
  doctorId: string;
  /** Clinic-local date the range starts from. */
  startDate: string;
}

/** "Apply template": generate a doctor's slots over a date range from a working-hours template. */
@Component({
  selector: 'app-apply-template-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'applyTemplate.title' | translate }}</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        @if (result(); as r) {
          <div class="result" role="status">
            <mat-icon class="ok">check_circle</mat-icon>
            <p>{{ 'bulk.created' | translate: { count: r.created } }}</p>
            @if (r.skipped > 0) {
              <p class="muted">{{ 'bulk.skipped' | translate: { count: r.skipped } }}</p>
              @if (holidaySkips() > 0) {
                <p class="muted">
                  {{ 'applyTemplate.holidaySkipped' | translate: { count: holidaySkips() } }}
                </p>
              }
            }
          </div>
        } @else {
          <p class="muted">{{ 'applyTemplate.intro' | translate }}</p>
          @if (templates().length === 0 && loaded()) {
            <p class="error" role="alert">{{ 'applyTemplate.noTemplates' | translate }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'applyTemplate.template' | translate }}</mat-label>
            <mat-select [value]="templateId()" (selectionChange)="templateId.set($event.value)">
              @for (t of templates(); track t.id) {
                <mat-option [value]="t.id"
                  ><span dir="auto">{{ t.name }}</span> ({{ t.slotMinutes }}
                  {{ 'common.min' | translate }})</mat-option
                >
              }
            </mat-select>
          </mat-form-field>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'bulk.fromDate' | translate }}</mat-label>
              <input
                matInput
                type="date"
                [ngModel]="fromDate()"
                (ngModelChange)="fromDate.set($event)"
              />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'bulk.toDate' | translate }}</mat-label>
              <input
                matInput
                type="date"
                [ngModel]="toDate()"
                (ngModelChange)="toDate.set($event)"
              />
            </mat-form-field>
          </div>
          @if (!rangeValid()) {
            <p class="error" role="alert">{{ 'applyTemplate.badRange' | translate }}</p>
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="changed()">
        {{ (result() ? 'common.close' : 'common.cancel') | translate }}
      </button>
      @if (!result()) {
        <button
          mat-flat-button
          type="button"
          [disabled]="saving() || !templateId() || !rangeValid()"
          (click)="apply()"
        >
          {{ 'applyTemplate.apply' | translate }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
    }
    mat-form-field {
      inline-size: 100%;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .result {
      text-align: center;
      padding-block: 8px;
    }
    .ok {
      color: var(--ml-completed);
      font-size: 40px;
      inline-size: 40px;
      block-size: 40px;
    }
  `,
})
export class ApplyTemplateDialog {
  protected readonly data = inject<ApplyTemplateData>(MAT_DIALOG_DATA);
  private readonly api = inject(WorkingHoursApi);

  protected readonly templates = signal<WorkingHoursTemplate[]>([]);
  protected readonly loaded = signal(false);
  protected readonly templateId = signal('');
  protected readonly fromDate = signal(this.data.startDate);
  protected readonly toDate = signal(addDays(this.data.startDate, 27));
  protected readonly saving = signal(false);
  protected readonly result = signal<BulkSlotsResult | null>(null);
  protected readonly changed = signal(false);

  protected readonly rangeValid = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    return !!from && !!to && diffDays(from, to) >= 0 && diffDays(from, to) <= 92;
  });

  protected readonly holidaySkips = computed(
    () => this.result()?.skippedSlots?.filter((s) => s.reason === 'holiday').length ?? 0,
  );

  constructor() {
    this.api.list().subscribe((list) => {
      this.templates.set(list);
      this.loaded.set(true);
      if (list.length === 1) this.templateId.set(list[0].id);
    });
  }

  protected apply(): void {
    if (!this.templateId() || !this.rangeValid() || this.saving()) return;
    this.saving.set(true);
    this.api
      .apply(this.data.doctorId, {
        templateId: this.templateId(),
        fromDate: this.fromDate(),
        toDate: this.toDate(),
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.result.set(result);
          this.changed.set(true);
        },
        error: () => this.saving.set(false),
      });
  }
}
