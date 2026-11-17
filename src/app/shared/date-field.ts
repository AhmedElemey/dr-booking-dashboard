import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule, SubscriptSizing } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { DateTime } from 'luxon';

import { dateTimeToKey, keyToDateTime } from './date-key';

/**
 * Material date picker that reads and writes `yyyy-MM-dd` strings, so it drops into
 * `ngModel` / `formControlName` wherever a native `<input type="date">` was used.
 * Display and typing format come from the date adapter (day first, locale follows the UI language).
 */
@Component({
  selector: 'app-date-field',
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <mat-form-field appearance="outline" [subscriptSizing]="subscriptSizing()">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        [matDatepicker]="picker"
        [value]="date()"
        [disabled]="disabled()"
        [errorStateMatcher]="matcher"
        (dateInput)="changed($event.value)"
        (dateChange)="changed($event.value)"
        (blur)="touched()"
      />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker (closed)="touched()" />
      @if (error()) {
        <mat-error>{{ error() }}</mat-error>
      } @else if (control?.hasError('required')) {
        <mat-error>{{ 'validation.required' | translate }}</mat-error>
      }
    </mat-form-field>
  `,
})
export class DateField implements ControlValueAccessor {
  readonly label = input.required<string>();
  /** Extra error text (for example a cross-field rule); shown while the control is invalid. */
  readonly error = input<string | null>(null);
  readonly subscriptSizing = input<SubscriptSizing>('fixed');

  protected readonly date = signal<DateTime | null>(null);
  protected readonly disabled = signal(false);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  protected get control() {
    return this.ngControl?.control ?? null;
  }

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly matcher: ErrorStateMatcher = {
    isErrorState: () => {
      const control = this.ngControl?.control;
      return !!control && control.invalid && (control.touched || control.dirty);
    },
  };

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  writeValue(value: string | null): void {
    this.date.set(keyToDateTime(value));
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected changed(value: DateTime | null): void {
    this.date.set(value);
    this.onChange(dateTimeToKey(value));
  }
  protected touched(): void {
    this.onTouched();
  }
}
