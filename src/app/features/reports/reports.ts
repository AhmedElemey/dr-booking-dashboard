import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { BookingsReport, GroupBy, RevenueReport } from '../../core/api/phase2.models';
import { ReportKind, ReportsApi } from '../../core/api/reports.api';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { addDays, diffDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { saveBlob } from '../../core/util/download';
import { egp } from '../../core/util/format';
import { BarChart, ChartSeries, HBarList } from '../../shared/charts';
import { DateField } from '../../shared/date-field';

export const MAX_REPORT_DAYS = 366;
const GROUPS: GroupBy[] = ['Day', 'Week', 'Month'];

/** The API's cancellationRate may be a fraction (0.12) or a percentage (12). */
export function ratePercent(rate: number): number {
  return rate <= 1 ? rate * 100 : rate;
}

/** reports: bookings and revenue over a date range, with simple charts and CSV download. */
@Component({
  selector: 'app-reports',
  imports: [
    DateField,
    FormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
    BarChart,
    HBarList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'reports.title' | translate }}</h1>
      </div>

      <div class="filters">
        <app-date-field
          [label]="'payments.from' | translate"
          subscriptSizing="dynamic"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
        <app-date-field
          [label]="'payments.to' | translate"
          subscriptSizing="dynamic"
          [ngModel]="to()"
          (ngModelChange)="to.set($event)"
        />
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'reports.groupBy' | translate }}</mat-label>
          <mat-select [value]="groupBy()" (selectionChange)="groupBy.set($event.value)">
            @for (g of groups; track g) {
              <mat-option [value]="g">{{ 'reports.group.' + g | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (doctors().length > 1) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select [value]="doctorId()" (selectionChange)="doctorId.set($event.value)">
              <mat-option value="">{{ 'common.all' | translate }}</mat-option>
              @for (d of doctors(); track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
      @if (!rangeValid()) {
        <p class="range-error" role="alert">{{ 'reports.rangeInvalid' | translate }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (bookings(); as b) {
        <section class="panel block" aria-labelledby="bookings-h">
          <div class="block-head">
            <h2 id="bookings-h">{{ 'reports.bookings' | translate }}</h2>
            <button mat-stroked-button type="button" (click)="download('bookings')">
              <mat-icon>download</mat-icon>{{ 'reports.csv' | translate }}
            </button>
          </div>
          <div class="kpis">
            <div class="kpi">
              <span class="v num">{{ b.totals.booked }}</span>
              <span class="l">{{ 'reports.kpi.booked' | translate }}</span>
            </div>
            <div class="kpi">
              <span class="v num good">{{ b.totals.completed }}</span>
              <span class="l">{{ 'reports.kpi.completed' | translate }}</span>
            </div>
            <div class="kpi">
              <span class="v num">{{ b.totals.cancelled }}</span>
              <span class="l">{{ 'reports.kpi.cancelled' | translate }}</span>
            </div>
            <div class="kpi">
              <span class="v num">{{ b.totals.noShow }}</span>
              <span class="l">{{ 'reports.kpi.noShow' | translate }}</span>
            </div>
            <div class="kpi">
              <span class="v num">{{ cancelRate() }}%</span>
              <span class="l">{{ 'reports.kpi.cancellationRate' | translate }}</span>
            </div>
          </div>
          <app-bar-chart
            [labels]="bookingLabels()"
            [series]="bookingSeries()"
            [label]="'reports.bookingsChart' | translate"
          />
          <div class="split">
            <div>
              <h3>{{ 'reports.byDoctor' | translate }}</h3>
              <app-hbar-list [items]="bookingsByDoctor()" [colors]="bookingColors" />
            </div>
            <div>
              <h3>{{ 'reports.byService' | translate }}</h3>
              <app-hbar-list [items]="bookingsByService()" [colors]="bookingColors" />
            </div>
            <div>
              <h3>{{ 'reports.bySource' | translate }}</h3>
              <app-hbar-list [items]="bySource()" [colors]="['var(--mat-sys-primary)']" />
            </div>
          </div>
        </section>
      }

      @if (revenue(); as r) {
        <section class="panel block" aria-labelledby="revenue-h">
          <div class="block-head">
            <h2 id="revenue-h">{{ 'reports.revenue' | translate }}</h2>
            <button mat-stroked-button type="button" (click)="download('revenue')">
              <mat-icon>download</mat-icon>{{ 'reports.csv' | translate }}
            </button>
          </div>
          <div class="kpis">
            @for (k of revenueKpis(); track k.key) {
              <div class="kpi">
                <span class="v num" [class.good]="k.key === 'collectedEgp'">{{ k.text }}</span>
                <span class="l">{{ 'reports.kpi.' + k.key | translate }}</span>
              </div>
            }
          </div>
          <app-bar-chart
            [labels]="revenueLabels()"
            [series]="revenueSeries()"
            [label]="'reports.revenueChart' | translate"
          />
          <h3>{{ 'reports.byDoctor' | translate }}</h3>
          <app-hbar-list [items]="revenueByDoctor()" [colors]="revenueColors" [format]="money" />
        </section>
      }
    </div>
  `,
  styles: `
    .range-error {
      color: var(--mat-sys-error);
      margin-block: -8px 12px;
    }
    .block {
      padding: 20px;
      margin-block-end: 20px;
      overflow: visible;
    }
    .block-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-block-end: 12px;
      h2 {
        margin: 0;
        font: var(--mat-sys-title-large);
      }
    }
    h3 {
      margin: 20px 0 12px;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-block-end: 16px;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container-low);
      .v {
        font: var(--mat-sys-headline-small);
      }
      .good {
        color: var(--ml-completed);
      }
      .l {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .split {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
  `,
})
export class Reports {
  private readonly api = inject(ReportsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly groups = GROUPS;
  protected readonly from = signal(addDays(this.clinicTime.today(), -29));
  protected readonly to = signal(this.clinicTime.today());
  protected readonly groupBy = signal<GroupBy>('Day');
  protected readonly doctorId = signal('');
  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly bookings = signal<BookingsReport | null>(null);
  protected readonly revenue = signal<RevenueReport | null>(null);
  protected readonly loading = signal(false);

  protected readonly bookingColors = ['var(--ml-confirmed)', 'var(--ml-completed)'];
  protected readonly revenueColors = ['var(--ml-confirmed)', 'var(--ml-completed)'];
  protected readonly money = (n: number) => egp(n);

  protected readonly rangeValid = computed(() => {
    const days = diffDays(this.from(), this.to());
    return !!this.from() && !!this.to() && days >= 0 && days + 1 <= MAX_REPORT_DAYS;
  });

  protected readonly cancelRate = computed(() => {
    const rate = this.bookings()?.totals.cancellationRate ?? 0;
    return Math.round(ratePercent(rate) * 10) / 10;
  });

  protected readonly bookingLabels = computed(() =>
    (this.bookings()?.series ?? []).map((p) => this.periodLabel(p.period)),
  );
  protected readonly bookingSeries = computed<ChartSeries[]>(() => {
    const series = this.bookings()?.series ?? [];
    return [
      {
        name: this.t('reports.kpi.booked'),
        values: series.map((p) => p.booked),
        color: 'var(--ml-confirmed)',
      },
      {
        name: this.t('reports.kpi.completed'),
        values: series.map((p) => p.completed),
        color: 'var(--ml-completed)',
      },
      {
        name: this.t('reports.kpi.cancelled'),
        values: series.map((p) => p.cancelled),
        color: 'var(--ml-noshow)',
      },
    ];
  });
  protected readonly bookingsByDoctor = computed(() =>
    (this.bookings()?.byDoctor ?? []).map((d) => ({
      name: d.name,
      values: [d.booked, d.completed],
    })),
  );
  protected readonly bookingsByService = computed(() =>
    (this.bookings()?.byService ?? []).map((d) => ({
      name: d.name,
      values: [d.booked, d.completed],
    })),
  );
  protected readonly bySource = computed(() => {
    const s = this.bookings()?.bySource;
    return s
      ? [
          { name: this.t('reports.source.patient'), values: [s.patient] },
          { name: this.t('reports.source.staff'), values: [s.staff] },
        ]
      : [];
  });

  protected readonly revenueLabels = computed(() =>
    (this.revenue()?.series ?? []).map((p) => this.periodLabel(p.period)),
  );
  protected readonly revenueSeries = computed<ChartSeries[]>(() => {
    const series = this.revenue()?.series ?? [];
    return [
      {
        name: this.t('reports.kpi.expectedEgp'),
        values: series.map((p) => p.expectedEgp),
        color: 'var(--ml-confirmed)',
      },
      {
        name: this.t('reports.kpi.collectedEgp'),
        values: series.map((p) => p.collectedEgp),
        color: 'var(--ml-completed)',
      },
    ];
  });
  protected readonly revenueByDoctor = computed(() =>
    (this.revenue()?.byDoctor ?? []).map((d) => ({
      name: d.name,
      values: [d.expectedEgp, d.collectedEgp],
    })),
  );
  protected readonly revenueKpis = computed(() => {
    const totals = this.revenue()?.totals;
    if (!totals) return [];
    const keys = [
      'expectedEgp',
      'collectedEgp',
      'onlineEgp',
      'cashEgp',
      'discountsEgp',
      'refundsEgp',
    ] as const;
    return keys.map((key) => ({
      key,
      text: `${egp(totals[key])} ${this.t('common.egp')}`,
    }));
  });

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    effect(() => {
      const query = {
        from: this.from(),
        to: this.to(),
        groupBy: this.groupBy(),
        doctorId: this.doctorId() || undefined,
      };
      // Reading the language keeps the label text reactive too.
      this.languages.language();
      if (this.rangeValid()) this.load(query);
    });
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }

  private load(query: { from: string; to: string; groupBy: GroupBy; doctorId?: string }): void {
    this.loading.set(true);
    forkJoin([this.api.bookings(query), this.api.revenue(query)]).subscribe({
      next: ([bookings, revenue]) => {
        this.bookings.set(bookings);
        this.revenue.set(revenue);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  /** Day periods read as "14 Nov"; week and month periods are shown as the API names them. */
  private periodLabel(period: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(period) ? this.clinicTime.keyLabel(period, 'd LLL') : period;
  }

  protected download(kind: ReportKind): void {
    if (!this.rangeValid()) return;
    const query = {
      from: this.from(),
      to: this.to(),
      groupBy: this.groupBy(),
      doctorId: this.doctorId() || undefined,
    };
    this.api
      .csv(kind, query)
      .subscribe((blob) => saveBlob(blob, `${kind}-${query.from}_${query.to}.csv`));
  }
}
