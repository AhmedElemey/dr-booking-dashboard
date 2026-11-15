import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Role } from '../app/core/api/models';
import { AuthService } from '../app/core/auth/auth.service';
import { API_ROOT } from '../app/core/config/api-url';
import { FeaturesService } from '../app/core/config/features.service';
import { provideFixedClock, provideTestTranslations } from './test-providers';

export interface Harness<T> {
  fixture: ComponentFixture<T>;
  el: HTMLElement;
  backend: HttpTestingController;
  dialogOpen: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.fn>;
  features: FeaturesService;
  settle: () => Promise<void>;
}

export interface SetupOptions {
  lang?: 'ar' | 'en';
  /** Dialog results in the order the component opens them (default: confirm everything). */
  dialogResults?: unknown[];
  providers?: Provider[];
  /** Phase 2 switches to turn on before the component is created. */
  features?: string[];
  /** Signed-in role (default: nobody). */
  role?: Role;
}

/** Creates a component with HTTP, translations, a fixed clock and stubbed dialogs and toasts. */
export function setupPage<T>(component: Type<T>, options: SetupOptions = {}): Harness<T> {
  localStorage.clear();
  const results = [...(options.dialogResults ?? [])];
  const dialogOpen = vi.fn(() => ({
    afterClosed: () => of(results.length ? results.shift() : true),
  }));
  const snackOpen = vi.fn();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTestTranslations(options.lang ?? 'en'),
      provideFixedClock('2026-11-14T10:00:00'),
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: MatSnackBar, useValue: { open: snackOpen } },
      ...(options.providers ?? []),
    ],
  });
  const features = TestBed.inject(FeaturesService);
  if (options.features) {
    features.features.update((f) => ({
      ...f,
      ...Object.fromEntries(options.features!.map((k) => [k, true])),
    }));
  }
  if (options.role) {
    TestBed.inject(AuthService).user.set({
      id: 'u-test',
      phone: '+201000000001',
      fullName: 'Test User',
      role: options.role,
      preferredLanguage: 'en',
      clinicId: 'c1',
    });
  }
  const backend = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(component);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    backend,
    dialogOpen,
    snackOpen,
    features,
    settle,
  };
}

/** The pending request for `METHOD path` (query string ignored), flushed with `body`. */
export function answer(
  backend: HttpTestingController,
  method: string,
  path: string,
  body: Parameters<TestRequest['flush']>[0],
  init?: { status?: number; statusText?: string },
): TestRequest {
  const req = backend.expectOne((r) => r.method === method && r.url === `${API_ROOT}${path}`);
  req.flush(body, init);
  return req;
}

/** Reads a protected member of a component under test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Internals = Record<string, any>;

export function internals<T>(fixture: ComponentFixture<T>): Internals {
  return fixture.componentInstance as unknown as Internals;
}

export const texts = (el: Element, selector: string) =>
  [...el.querySelectorAll(selector)].map((n) => n.textContent!.replace(/\s+/g, ' ').trim());

/** Answers the doctor list that most pages request on startup. */
export function flushDoctors(backend: HttpTestingController, doctors: unknown[] = []): void {
  backend
    .match((r) => r.method === 'GET' && r.url === `${API_ROOT}/dashboard/doctors`)
    .forEach((r) => r.flush(doctors as never));
}

/** The one pending GET of `path`, with its query parameters. */
export function pendingGet(backend: HttpTestingController, path: string): TestRequest {
  return backend.expectOne((r) => r.method === 'GET' && r.url === `${API_ROOT}${path}`);
}
