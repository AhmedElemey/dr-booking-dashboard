import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { WorkingHoursTemplate } from '../../core/api/phase2.models';
import { WorkingHoursApi } from '../../core/api/working-hours.api';
import { ToastService } from '../../core/http/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { RuleSummary, summarizeRules } from './rules';
import { TemplateDialog } from './template-dialog';

/** workingHoursTemplates: weekly hour patterns that can be applied to a doctor's calendar. */
@Component({
  selector: 'app-working-hours',
  imports: [MatButton, MatIconButton, MatIcon, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'workingHours.title' | translate }}</h1>
        <button mat-flat-button type="button" (click)="open()">
          <mat-icon>add</mat-icon>{{ 'workingHours.add' | translate }}
        </button>
      </div>
      <p class="muted">{{ 'workingHours.intro' | translate }}</p>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (templates().length === 0 && !loading()) {
          <p class="empty-state">{{ 'workingHours.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'workingHours.name' | translate }}</th>
                  <th scope="col">{{ 'workingHours.slotMinutes' | translate }}</th>
                  <th scope="col">{{ 'workingHours.rules' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (t of templates(); track t.id) {
                  <tr>
                    <td [attr.data-label]="'workingHours.name' | translate">
                      <strong dir="auto">{{ t.name }}</strong>
                    </td>
                    <td class="num" [attr.data-label]="'workingHours.slotMinutes' | translate">
                      {{ t.slotMinutes }} {{ 'common.min' | translate }}
                    </td>
                    <td [attr.data-label]="'workingHours.rules' | translate">
                      @for (line of summary(t); track line.hours) {
                        <div>
                          {{ line.days }}:
                          <span class="ltr-text hours">{{ line.hours }}</span>
                        </div>
                      }
                    </td>
                    <td class="end">
                      <span class="row-actions">
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.edit' | translate"
                          (click)="open(t)"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.delete' | translate"
                          (click)="remove(t)"
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
})
export class WorkingHours {
  private readonly api = inject(WorkingHoursApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly templates = signal<WorkingHoursTemplate[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.templates.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected summary(t: WorkingHoursTemplate): RuleSummary[] {
    return summarizeRules(t.rules, (key) => this.translate.instant(`days.${key}`));
  }

  protected open(template?: WorkingHoursTemplate): void {
    this.dialog
      .open(TemplateDialog, { data: { template }, maxWidth: '96vw' })
      .afterClosed()
      .pipe(filter((saved): saved is WorkingHoursTemplate => !!saved))
      .subscribe(() => {
        this.toast.success('workingHours.saved');
        this.load();
      });
  }

  protected remove(template: WorkingHoursTemplate): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'workingHours.deleteTitle',
          messageKey: 'workingHours.deleteMessage',
          messageParams: { name: template.name },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.delete(template.id)),
      )
      .subscribe(() => {
        this.toast.success('workingHours.deleted');
        this.load();
      });
  }
}
