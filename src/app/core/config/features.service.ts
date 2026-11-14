import { HttpClient, HttpContext } from '@angular/common/http';
import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';

import { SKIP_ERROR_TOAST } from '../http/http-context';
import { BRAND, FEATURE_KEYS, FeatureFlags, FeatureKey } from './brand';
import { apiUrl } from './api-url';

export const FEATURES_CACHE_KEY = 'moonlight.features';
export const FEATURES_REFRESH_MS = 5 * 60 * 1000;

interface FeaturesResponse {
  features?: Record<string, unknown>;
  source?: string;
  updatedAt?: string;
}

/** Keeps only known boolean switches; anything else falls back to the config default. */
export function mergeFeatures(raw: unknown): FeatureFlags {
  const merged = { ...BRAND.features } as FeatureFlags;
  if (raw && typeof raw === 'object') {
    for (const key of FEATURE_KEYS) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === 'boolean') merged[key] = value;
    }
  }
  return merged;
}

/**
 * The clinic's feature switches. Starts from the last value seen (localStorage) or the defaults in
 * clinic.config.json, then follows `GET /features` at startup and every five minutes.
 */
@Injectable({ providedIn: 'root' })
export class FeaturesService {
  // Resolved lazily so that merely reading a switch never needs the HTTP stack.
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly features = signal<FeatureFlags>(this.cached());

  /** A feature the backend refused because it is switched off; shown as a banner. */
  readonly disabledNotice = signal<FeatureKey | null>(null);

  readonly englishLanguage = computed(() => this.features().englishLanguage);
  readonly multiBranch = computed(() => this.features().multiBranch);
  /** Exposed for completeness: staff can always cancel, whatever patients may do. */
  readonly patientSelfService = computed(() => this.features().patientSelfService);

  private started = false;

  /** Fetches now and every five minutes. Safe to call more than once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    timer(0, FEATURES_REFRESH_MS)
      .pipe(
        switchMap(() => this.fetch()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** One fetch; failures are swallowed so the last known value stays in force. */
  private fetch() {
    return this.injector
      .get(HttpClient)
      .get<FeaturesResponse>(apiUrl('/features'), {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(
        switchMap((response) => {
          this.apply(response?.features);
          return EMPTY;
        }),
        catchError(() => EMPTY),
      );
  }

  private apply(raw: unknown): void {
    const next = mergeFeatures(raw);
    this.features.set(next);
    try {
      localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the value just is not remembered.
    }
  }

  private cached(): FeatureFlags {
    try {
      const stored = localStorage.getItem(FEATURES_CACHE_KEY);
      if (stored) return mergeFeatures(JSON.parse(stored));
    } catch {
      // Unreadable cache: use the defaults.
    }
    return mergeFeatures(null);
  }

  /** The API answered 403 FEATURE_DISABLED: believe it now rather than at the next refresh. */
  reportDisabled(feature: string | undefined): void {
    const key = FEATURE_KEYS.find((k) => k === feature);
    if (!key) return;
    this.features.update((f) => ({ ...f, [key]: false }));
    this.disabledNotice.set(key);
  }

  dismissNotice(): void {
    this.disabledNotice.set(null);
  }
}
