import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { DateTime } from 'luxon';

import { provideTestTranslations } from '../../testing/test-providers';
import { DateField } from './date-field';
import { dateTimeToKey, keyToDateTime } from './date-key';

@Component({
  imports: [DateField, FormsModule],
  template: `<app-date-field
    label="Date"
    [ngModel]="value()"
    (ngModelChange)="value.set($event)"
  />`,
})
class Host {
  readonly value = signal('2026-11-17');
}

describe('date key helpers', () => {
  it('converts between yyyy-MM-dd keys and Luxon dates', () => {
    expect(keyToDateTime('2026-11-17')?.day).toBe(17);
    expect(keyToDateTime('')).toBeNull();
    expect(keyToDateTime('nope')).toBeNull();
    expect(dateTimeToKey(DateTime.fromISO('2026-01-05'))).toBe('2026-01-05');
    expect(dateTimeToKey(null)).toBe('');
  });
});

describe('DateField', () => {
  it('shows a key day-first and writes keys back', async () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTestTranslations('en')] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('17/11/2026');

    input.value = '03/12/2026';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.value()).toBe('2026-12-03');
  });

  it('switches the adapter locale with the language and keeps Latin digits', () => {
    TestBed.configureTestingModule({ providers: [provideTestTranslations('ar')] });
    const adapter = TestBed.inject(DateAdapter) as DateAdapter<DateTime>;
    const date = DateTime.fromISO('2026-11-17');
    expect(adapter.format(date, 'dd/MM/yyyy')).toBe('17/11/2026');
  });
});
