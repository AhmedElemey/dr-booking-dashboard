import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ChartSeries {
  name: string;
  values: number[];
  /** Any CSS colour or custom property, e.g. `var(--ml-completed)`. */
  color: string;
}

const W = 720;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

/**
 * A "nice" axis for a data maximum: a step of 1, 2, 2.5, 5 or 10 times a power of ten, with at
 * most five intervals from zero to the axis end.
 */
export function niceAxis(max: number): { step: number; end: number; intervals: number } {
  if (max <= 0) return { step: 1, end: 4, intervals: 4 };
  const rough = max / 5;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => s >= rough) ?? 10 * exp;
  const intervals = Math.ceil(max / step);
  return { step, end: step * intervals, intervals };
}

/**
 * Lightweight grouped bar chart in plain SVG (no chart library). Text alternative: the figure is
 * labelled and a visually hidden table carries the numbers.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure>
      <svg
        [attr.viewBox]="'0 0 ' + w + ' ' + h"
        role="img"
        [attr.aria-label]="label()"
        preserveAspectRatio="xMidYMid meet"
      >
        @for (t of ticks(); track t.value) {
          <line
            [attr.x1]="pad.left"
            [attr.x2]="w - pad.right"
            [attr.y1]="t.y"
            [attr.y2]="t.y"
            class="grid"
          />
          <text [attr.x]="pad.left - 6" [attr.y]="t.y + 4" class="tick" text-anchor="end">
            {{ t.label }}
          </text>
        }
        @for (g of groups(); track g.index) {
          @for (b of g.bars; track b.series) {
            <rect
              [attr.x]="b.x"
              [attr.y]="b.y"
              [attr.width]="b.width"
              [attr.height]="b.height"
              [attr.fill]="b.color"
              rx="2"
            >
              <title>{{ g.label }} - {{ b.series }}: {{ b.text }}</title>
            </rect>
          }
          @if (g.showLabel) {
            <text [attr.x]="g.center" [attr.y]="h - 8" class="tick" text-anchor="middle">
              {{ g.label }}
            </text>
          }
        }
      </svg>
      <figcaption>
        <ul class="legend">
          @for (s of series(); track s.name) {
            <li><span class="swatch" [style.background]="s.color"></span>{{ s.name }}</li>
          }
        </ul>
      </figcaption>
      <table class="sr-only">
        <caption>
          {{
            label()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col"></th>
            @for (s of series(); track s.name) {
              <th scope="col">{{ s.name }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (l of labels(); track $index) {
            <tr>
              <th scope="row">{{ l }}</th>
              @for (s of series(); track s.name) {
                <td>{{ s.values[$index] }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }
    figure {
      margin: 0;
    }
    svg {
      inline-size: 100%;
      block-size: auto;
      direction: ltr;
    }
    .grid {
      stroke: var(--mat-sys-outline-variant);
      stroke-width: 1;
    }
    .tick {
      font-size: 11px;
      fill: var(--mat-sys-on-surface-variant);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      font-size: 13px;
    }
    .legend li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 3px;
    }
  `,
})
export class BarChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly label = input.required<string>();
  readonly format = input<(n: number) => string>((n) => String(n));

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;

  private readonly axis = computed(() =>
    niceAxis(Math.max(0, ...this.series().flatMap((s) => s.values))),
  );

  protected readonly ticks = computed(() => {
    const { step, intervals } = this.axis();
    const plotH = H - PAD.top - PAD.bottom;
    return Array.from({ length: intervals + 1 }, (_, i) => ({
      value: step * i,
      y: PAD.top + plotH - (plotH * i) / intervals,
      label: this.format()(step * i),
    }));
  });

  protected readonly groups = computed(() => {
    const labels = this.labels();
    const series = this.series();
    const max = this.axis().end;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const groupW = plotW / Math.max(labels.length, 1);
    const inner = groupW * 0.78;
    const barW = Math.max(inner / Math.max(series.length, 1), 1);
    const labelEvery = Math.max(1, Math.ceil(labels.length / 12));
    return labels.map((label, index) => {
      const x0 = PAD.left + groupW * index + (groupW - barW * series.length) / 2;
      return {
        index,
        label,
        center: PAD.left + groupW * index + groupW / 2,
        showLabel: index % labelEvery === 0,
        bars: series.map((s, i) => {
          const value = s.values[index] ?? 0;
          const height = (value / max) * plotH;
          return {
            series: s.name,
            color: s.color,
            text: this.format()(value),
            x: x0 + barW * i,
            width: Math.max(barW - 1, 1),
            y: PAD.top + plotH - height,
            height,
          };
        }),
      };
    });
  });
}

/** Horizontal bars (CSS) for "by doctor" style breakdowns. */
@Component({
  selector: 'app-hbar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      @for (row of rows(); track row.name) {
        <li>
          <span class="name">{{ row.name }}</span>
          <span class="track" aria-hidden="true">
            @for (v of row.values; track $index) {
              <span
                class="bar"
                [style.inline-size.%]="v.percent"
                [style.background]="v.color"
              ></span>
            }
          </span>
          <span class="nums">
            @for (v of row.values; track $index) {
              <span [style.color]="v.color">{{ v.text }}</span>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    li {
      display: grid;
      grid-template-columns: minmax(90px, 1fr) 2fr auto;
      gap: 12px;
      align-items: center;
    }
    .track {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .bar {
      display: block;
      block-size: 8px;
      border-radius: 4px;
      min-inline-size: 2px;
    }
    .nums {
      display: flex;
      gap: 10px;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      white-space: nowrap;
    }
  `,
})
export class HBarList {
  /** Each item has a name and one value per series (same order as `colors`). */
  readonly items = input.required<{ name: string; values: number[] }[]>();
  readonly colors = input.required<string[]>();
  readonly format = input<(n: number) => string>((n) => String(n));

  protected readonly rows = computed(() => {
    const items = this.items();
    const max = Math.max(1, ...items.flatMap((i) => i.values));
    return items.map((item) => ({
      name: item.name,
      values: item.values.map((v, i) => ({
        percent: (v / max) * 100,
        color: this.colors()[i],
        text: this.format()(v),
      })),
    }));
  });
}
