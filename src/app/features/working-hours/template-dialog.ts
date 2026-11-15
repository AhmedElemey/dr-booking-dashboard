import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { DayName } from '../../core/api/models';
import { TemplateRule, WorkingHoursTemplate } from '../../core/api/phase2.models';
import { WorkingHoursApi } from '../../core/api/working-hours.api';
import { SLOT_LENGTHS, WEEKDAY_OPTIONS, validateRules } from './rules';

export interface TemplateDialogData {
  template?: WorkingHoursTemplate;
}

interface EditableRule extends TemplateRule {
  uid: number;
}

/** Create or edit a weekly working-hours template (rules editor). Closes with the saved template. */
@Component({
  selector: 'app-template-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButton,
    MatIconButton,
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
    <h2 mat-dialog-title>
      {{ (data.template ? 'workingHours.editTitle' : 'workingHours.addTitle') | translate }}
    </h2>
    <form (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="dialog-form">
          <div class="head">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'workingHours.name' | translate }}</mat-label>
              <input
                matInput
                name="name"
                required
                maxlength="80"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
              />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'workingHours.slotMinutes' | translate }}</mat-label>
              <mat-select [value]="slotMinutes()" (selectionChange)="slotMinutes.set($event.value)">
                @for (m of lengths; track m) {
                  <mat-option [value]="m">{{ m }} {{ 'common.min' | translate }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <fieldset>
            <legend>{{ 'workingHours.rules' | translate }}</legend>
            @for (rule of rules(); track rule.uid; let i = $index) {
              <div
                class="rule"
                role="group"
                [attr.aria-label]="('workingHours.rule' | translate) + ' ' + (i + 1)"
              >
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'workingHours.day' | translate }}</mat-label>
                  <mat-select
                    [value]="rule.dayOfWeek"
                    (selectionChange)="patch(rule.uid, { dayOfWeek: $event.value })"
                  >
                    @for (d of weekdays; track d.name) {
                      <mat-option [value]="d.name">{{ 'days.' + d.key | translate }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'workingHours.from' | translate }}</mat-label>
                  <input
                    matInput
                    type="time"
                    step="900"
                    [name]="'start' + rule.uid"
                    [ngModel]="rule.start"
                    (ngModelChange)="patch(rule.uid, { start: $event })"
                  />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'workingHours.to' | translate }}</mat-label>
                  <input
                    matInput
                    type="time"
                    step="900"
                    [name]="'end' + rule.uid"
                    [ngModel]="rule.end"
                    (ngModelChange)="patch(rule.uid, { end: $event })"
                  />
                </mat-form-field>
                <button
                  mat-icon-button
                  type="button"
                  [attr.aria-label]="'workingHours.removeRule' | translate"
                  (click)="removeRule(rule.uid)"
                >
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            }
            <div class="add-row">
              <button mat-stroked-button type="button" (click)="addRule()">
                <mat-icon>add</mat-icon>{{ 'workingHours.addRule' | translate }}
              </button>
              <button mat-button type="button" (click)="addWorkWeek()">
                {{ 'workingHours.fillWeek' | translate }}
              </button>
            </div>
          </fieldset>

          @if (submitted() && problems().length > 0) {
            <ul class="issues" role="alert">
              @for (p of problems(); track p) {
                <li>{{ 'workingHours.issues.' + p | translate }}</li>
              }
            </ul>
          }
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
    .head {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
      margin-block-end: 16px;
    }
    fieldset {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding-block: 8px 12px;
      padding-inline: 12px;
      margin: 0;
    }
    legend {
      padding-inline: 4px;
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant);
    }
    .rule {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr auto;
      gap: 8px;
      align-items: center;
      margin-block-end: 8px;
    }
    .add-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .issues {
      color: var(--mat-sys-error);
      margin: 12px 0 0;
      padding-inline-start: 20px;
    }
    @media (max-width: 600px) {
      .rule,
      .head {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class TemplateDialog {
  protected readonly data = inject<TemplateDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<TemplateDialog, WorkingHoursTemplate>>(MatDialogRef);
  private readonly api = inject(WorkingHoursApi);

  protected readonly weekdays = WEEKDAY_OPTIONS;
  protected readonly lengths = SLOT_LENGTHS;
  private uid = 0;

  protected readonly name = signal(this.data.template?.name ?? '');
  protected readonly slotMinutes = signal(this.data.template?.slotMinutes ?? 30);
  protected readonly rules = signal<EditableRule[]>(
    (this.data.template?.rules ?? [{ dayOfWeek: 'Sunday', start: '09:00', end: '14:00' }]).map(
      (r) => ({ ...r, uid: ++this.uid }),
    ),
  );
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);

  protected readonly problems = computed(() => {
    const list = validateRules(this.rules(), Number(this.slotMinutes()));
    return this.name().trim() ? list : ['name' as const, ...list];
  });

  protected patch(uid: number, change: Partial<TemplateRule>): void {
    this.rules.update((rules) => rules.map((r) => (r.uid === uid ? { ...r, ...change } : r)));
  }

  protected addRule(): void {
    this.rules.update((rules) => [
      ...rules,
      { uid: ++this.uid, dayOfWeek: 'Sunday' as DayName, start: '09:00', end: '14:00' },
    ]);
  }

  /** Sunday to Thursday, 09:00-14:00: the usual Egyptian clinic week. */
  protected addWorkWeek(): void {
    const days: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    this.rules.set(
      days.map((d) => ({ uid: ++this.uid, dayOfWeek: d, start: '09:00', end: '14:00' })),
    );
  }

  protected removeRule(uid: number): void {
    this.rules.update((rules) => rules.filter((r) => r.uid !== uid));
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.problems().length > 0 || this.saving()) return;
    const body = {
      name: this.name().trim(),
      slotMinutes: Number(this.slotMinutes()),
      rules: this.rules().map(({ dayOfWeek, start, end }) => ({ dayOfWeek, start, end })),
    };
    this.saving.set(true);
    const request$ = this.data.template
      ? this.api.update(this.data.template.id, body)
      : this.api.create(body);
    request$.subscribe({
      next: (saved) => this.ref.close(saved),
      error: () => this.saving.set(false),
    });
  }
}
