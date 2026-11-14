import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Slot } from '../core/api/models';
import { ClinicTime } from '../core/time/clinic-time.service';

interface Day {
  key: string;
  slots: Slot[];
}

/** Day tabs plus a grid of open time chips, all shown in the clinic timezone. */
@Component({
  selector: 'app-slot-picker',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (days().length === 0) {
      <p class="muted empty">{{ 'slotPicker.none' | translate }}</p>
    } @else {
      <div class="days" role="tablist" [attr.aria-label]="'slotPicker.days' | translate">
        @for (day of days(); track day.key) {
          <button
            type="button"
            role="tab"
            class="day"
            [class.on]="day.key === activeDay()"
            [attr.aria-selected]="day.key === activeDay()"
            (click)="activeDayKey.set(day.key)"
          >
            <span class="dow">{{ clinicTime.keyLabel(day.key, 'ccc') }}</span>
            <span class="dom">{{ clinicTime.keyLabel(day.key, 'd LLL') }}</span>
          </button>
        }
      </div>
      <div class="times" role="listbox" [attr.aria-label]="'slotPicker.times' | translate">
        @for (slot of activeSlots(); track slot.id) {
          <button
            type="button"
            role="option"
            class="time"
            [class.on]="slot.id === selectedId()"
            [attr.aria-selected]="slot.id === selectedId()"
            (click)="selected.emit(slot)"
          >
            {{ clinicTime.time(slot.startsAt) }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    .empty {
      margin: 0;
      padding-block: 8px;
    }
    .days {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-block-end: 8px;
    }
    .day,
    .time {
      font: inherit;
      cursor: pointer;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-lowest);
      color: var(--mat-sys-on-surface);
      border-radius: 12px;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-block: 8px;
      padding-inline: 14px;
      min-inline-size: 72px;
      flex: none;
    }
    .dow {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .dom {
      font-weight: 500;
      white-space: nowrap;
    }
    .times {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 8px;
      margin-block-start: 8px;
    }
    .time {
      padding-block: 10px;
      font-weight: 500;
      direction: ltr;
    }
    .on {
      background: var(--mat-sys-primary);
      border-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .on .dow {
      color: inherit;
    }
  `,
})
export class SlotPicker {
  protected readonly clinicTime = inject(ClinicTime);

  readonly slots = input.required<Slot[]>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<Slot>();

  protected readonly activeDayKey = signal<string | null>(null);

  protected readonly days = computed<Day[]>(() => {
    const byDay = new Map<string, Slot[]>();
    for (const slot of [...this.slots()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = this.clinicTime.dateKey(slot.startsAt);
      byDay.set(key, [...(byDay.get(key) ?? []), slot]);
    }
    return [...byDay].map(([key, slots]) => ({ key, slots }));
  });

  protected readonly activeDay = computed(() => {
    const keys = this.days().map((d) => d.key);
    const chosen = this.activeDayKey();
    return chosen && keys.includes(chosen) ? chosen : (keys[0] ?? null);
  });

  protected readonly activeSlots = computed(
    () => this.days().find((d) => d.key === this.activeDay())?.slots ?? [],
  );

  constructor() {
    // Follow the selected slot's day when it is set from outside.
    effect(() => {
      const id = this.selectedId();
      const day = this.days().find((d) => d.slots.some((s) => s.id === id));
      if (day) this.activeDayKey.set(day.key);
    });
  }
}
