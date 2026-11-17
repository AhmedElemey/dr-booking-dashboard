import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessagesApi } from '../../core/api/messages.api';
import { MessageChannel, OutboundMessage, PageResult } from '../../core/api/phase2.models';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { DateField } from '../../shared/date-field';

const CHANNELS: MessageChannel[] = ['Push', 'Sms', 'WhatsApp'];

/** whatsappReminders: the log of every push / SMS / WhatsApp message the system sent. */
@Component({
  selector: 'app-messages',
  imports: [
    DateField,
    FormsModule,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'messages.title' | translate }}</h1>
      </div>
      <p class="muted intro">{{ 'messages.intro' | translate }}</p>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'messages.channel' | translate }}</mat-label>
          <mat-select [value]="channel()" (selectionChange)="setChannel($event.value)">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            @for (c of channels; track c) {
              <mat-option [value]="c">{{ 'messages.channels.' + c | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-date-field
          [label]="'payments.from' | translate"
          subscriptSizing="dynamic"
          [ngModel]="from()"
          (ngModelChange)="setFrom($event)"
        />
        <app-date-field
          [label]="'payments.to' | translate"
          subscriptSizing="dynamic"
          [ngModel]="to()"
          (ngModelChange)="setTo($event)"
        />
      </div>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (result().items.length === 0 && !loading()) {
          <p class="empty-state">{{ 'messages.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'payments.col.date' | translate }}</th>
                  <th scope="col">{{ 'messages.channel' | translate }}</th>
                  <th scope="col">{{ 'messages.to' | translate }}</th>
                  <th scope="col">{{ 'messages.kind' | translate }}</th>
                  <th scope="col">{{ 'messages.body' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (m of result().items; track m.id) {
                  <tr>
                    <td class="nowrap">
                      {{ clinicTime.date(m.createdAt) }}
                      <span class="ltr-text muted">{{ clinicTime.time(m.createdAt) }}</span>
                    </td>
                    <td>
                      <span class="pill info">{{
                        'messages.channels.' + m.channel | translate
                      }}</span>
                    </td>
                    <td>
                      <span class="ltr-text">{{ m.to }}</span>
                    </td>
                    <td>{{ kindLabel(m.kind) }}</td>
                    <td class="body" dir="auto">{{ m.body }}</td>
                    <td>
                      <span
                        class="pill"
                        [class.ok]="m.status === 'Sent'"
                        [class.bad]="m.status === 'Failed'"
                        >{{ 'messages.status.' + m.status | translate }}</span
                      >
                      @if (m.error) {
                        <div class="danger-text small">{{ m.error }}</div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (page() > 1 || hasNext()) {
            <div class="pager">
              <button
                mat-icon-button
                type="button"
                [disabled]="page() <= 1"
                [attr.aria-label]="'agenda.previous' | translate"
                (click)="page.set(page() - 1)"
              >
                <mat-icon class="mirror">chevron_left</mat-icon>
              </button>
              <span class="num">{{ page() }}</span>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext()"
                [attr.aria-label]="'agenda.next' | translate"
                (click)="page.set(page() + 1)"
              >
                <mat-icon class="mirror">chevron_right</mat-icon>
              </button>
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .intro {
      margin-block: -8px 16px;
    }
    .nowrap {
      white-space: nowrap;
    }
    .body {
      max-inline-size: 420px;
    }
    .small {
      font-size: 12px;
    }
  `,
})
export class Messages {
  private readonly api = inject(MessagesApi);
  private readonly translate = inject(TranslateService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly channels = CHANNELS;
  protected readonly channel = signal<MessageChannel | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly result = signal<PageResult<OutboundMessage>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 0,
  });

  constructor() {
    effect(() => {
      const query = {
        channel: this.channel(),
        from: this.from(),
        to: this.to(),
        page: this.page(),
      };
      this.loading.set(true);
      this.api.list(query).subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  protected setChannel(value: MessageChannel | ''): void {
    this.page.set(1);
    this.channel.set(value);
  }

  protected setFrom(value: string): void {
    this.page.set(1);
    this.from.set(value);
  }

  protected setTo(value: string): void {
    this.page.set(1);
    this.to.set(value);
  }

  protected hasNext(): boolean {
    const r = this.result();
    return r.pageSize > 0 && r.page * r.pageSize < r.totalCount;
  }

  /** A translated name for known kinds, otherwise `appointment_reminder` as "Appointment reminder". */
  protected kindLabel(kind: string): string {
    const key = `messages.kinds.${kind.toLowerCase().replace(/[-\s]+/g, '_')}`;
    const known = this.translate.instant(key);
    if (known !== key) return known;
    const text = kind.replace(/[_-]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
