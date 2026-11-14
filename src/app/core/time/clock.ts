import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';

/** Wrapper around the system clock so time-dependent UI can be tested. */
@Injectable({ providedIn: 'root' })
export class Clock {
  now(): DateTime {
    return DateTime.now();
  }
}
