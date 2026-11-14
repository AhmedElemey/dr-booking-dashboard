import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** Side panel that slides in from the inline-end edge (right in LTR, left in RTL). */
@Component({
  selector: 'app-drawer',
  imports: [MatIconButton, MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="backdrop"
      tabindex="-1"
      aria-hidden="true"
      (click)="closed.emit()"
    ></button>
    <aside class="panel" role="dialog" aria-modal="true" [attr.aria-label]="heading()">
      <header>
        <h2>{{ heading() }}</h2>
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'common.close' | translate"
          (click)="closed.emit()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </header>
      <div class="body"><ng-content /></div>
    </aside>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 900;
    }
    .backdrop {
      border: 0;
      padding: 0;
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 32%);
    }
    .panel {
      position: absolute;
      inset-block: 0;
      inset-inline-end: 0;
      inline-size: min(460px, 100%);
      display: flex;
      flex-direction: column;
      background: var(--mat-sys-surface);
      box-shadow: var(--mat-sys-level3);
      animation: slide-in 180ms ease-out;
    }
    :host-context([dir='rtl']) .panel {
      animation-name: slide-in-rtl;
    }
    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-block: 8px;
      padding-inline: 20px 8px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }
    h2 {
      flex: 1;
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    @keyframes slide-in {
      from {
        transform: translateX(100%);
      }
    }
    @keyframes slide-in-rtl {
      from {
        transform: translateX(-100%);
      }
    }
  `,
})
export class Drawer {
  readonly heading = input.required<string>();
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
