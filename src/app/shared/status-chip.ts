import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AppointmentStatus, SlotStatus } from '../core/api/models';

/** Colored pill for an appointment or slot status. */
@Component({
  selector: 'app-status-chip',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="'chip chip-' + status().toLowerCase()">{{
    'status.' + status() | translate
  }}</span>`,
  styles: `
    .chip {
      display: inline-block;
      padding-block: 2px;
      padding-inline: 10px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .chip-confirmed,
    .chip-reserved {
      background: var(--ml-confirmed-bg);
      color: var(--ml-confirmed);
    }
    .chip-completed,
    .chip-open {
      background: var(--ml-completed-bg);
      color: var(--ml-completed);
    }
    .chip-noshow {
      background: var(--ml-noshow-bg);
      color: var(--ml-noshow);
    }
    .chip-cancelled,
    .chip-blocked {
      background: var(--ml-cancelled-bg);
      color: var(--ml-cancelled);
    }
    .chip-checkedin {
      background: var(--ml-completed-bg);
      color: var(--ml-completed);
    }
    .chip-inprogress {
      background: var(--ml-confirmed-bg);
      color: var(--ml-confirmed);
    }
  `,
})
export class StatusChip {
  readonly status = input.required<AppointmentStatus | SlotStatus>();
}
