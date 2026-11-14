import { Component, computed, input } from '@angular/core';
import { RepRecord, TracePoint } from '../../core/models';
import { Thresholds } from '../../utils/rep-counter';

const W = 600, H = 200, PL = 34, PR = 10, PT = 10, PB = 22;
const GAP_MS = 400; // break the line when tracking was lost

@Component({
  selector: 'app-motion-chart',
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Joint angle over time">
      @for (g of grid; track g) {
        <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="yOf(g)" [attr.y2]="yOf(g)" class="grid" />
        <text [attr.x]="PL - 6" [attr.y]="yOf(g) + 4" class="lbl end">{{ g }}°</text>
      }
      @for (t of xTicks(); track t.x) {
        <text [attr.x]="t.x" [attr.y]="H - 6" class="lbl mid">{{ t.label }}</text>
      }
      @for (y of limits(); track y) {
        <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="y" [attr.y2]="y" class="limit" />
      }
      @for (m of markers(); track m.key) {
        <line [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="PT" [attr.y2]="H - PB" class="rep" [class.partial]="!m.counted" />
        <text [attr.x]="m.x" [attr.y]="PT + 10" class="lbl mid">{{ m.label }}</text>
      }
      <path [attr.d]="path()" class="curve" />
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; background: #0e1116; border-radius: 10px; }
    .grid { stroke: #ffffff22; stroke-width: 1; }
    .limit { stroke: #ffb300; stroke-width: 1; stroke-dasharray: 5 4; opacity: .8; }
    .rep { stroke: #ffffff55; stroke-width: 1; stroke-dasharray: 2 3; }
    .rep.partial { stroke: #ff4d4d99; }
    .curve { fill: none; stroke: #00e5a0; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .lbl { fill: #ffffffaa; font: 11px system-ui; }
    .end { text-anchor: end; }
    .mid { text-anchor: middle; }
  `,
})
export class MotionChart {
  readonly points = input.required<TracePoint[]>();
  readonly thresholds = input<Thresholds | null>(null);
  readonly reps = input<RepRecord[]>([]);
  /** If set, shows a sliding window of this many ms ending at the latest point. */
  readonly windowMs = input<number | null>(null);

  protected readonly W = W; protected readonly H = H;
  protected readonly PL = PL; protected readonly PR = PR;
  protected readonly PT = PT; protected readonly PB = PB;
  protected readonly grid = [0, 45, 90, 135, 180];

  private readonly domain = computed(() => {
    const pts = this.points();
    const last = pts.length ? pts[pts.length - 1].t : 0;
    const win = this.windowMs();
    if (win) { const t0 = Math.max(0, last - win); return { t0, t1: t0 + win }; }
    return { t0: 0, t1: Math.max(1000, last) };
  });

  protected readonly path = computed(() => {
    const d = this.domain();
    let out = '';
    let prev: number | null = null;
    for (const p of this.points()) {
      if (p.t < d.t0) continue;
      const cmd = prev === null || p.t - prev > GAP_MS ? 'M' : 'L';
      out += `${cmd}${this.xOf(p.t, d).toFixed(1)} ${this.yOf(p.a).toFixed(1)} `;
      prev = p.t;
    }
    return out;
  });

  protected readonly xTicks = computed(() => {
    const d = this.domain();
    return Array.from({ length: 5 }, (_, i) => {
      const t = d.t0 + ((d.t1 - d.t0) * i) / 4;
      return { x: this.xOf(t, d), label: `${(t / 1000).toFixed(0)}s` };
    });
  });

  protected readonly limits = computed(() => {
    const th = this.thresholds();
    return th ? [this.yOf(th.topEnter), this.yOf(th.bottomEnter)] : [];
  });

  protected readonly markers = computed(() => {
    const d = this.domain();
    return this.reps()
      .filter(r => r.endMs >= d.t0 && r.endMs <= d.t1)
      .map(r => ({
        key: r.endMs,
        x: this.xOf(r.endMs, d),
        counted: r.counted,
        label: r.counted ? String(r.index) : '×',
      }));
  });

  protected yOf(a: number): number {
    const c = Math.min(180, Math.max(0, a));
    return PT + (1 - c / 180) * (H - PT - PB);
  }

  private xOf(t: number, d: { t0: number; t1: number }): number {
    return PL + ((t - d.t0) / Math.max(1, d.t1 - d.t0)) * (W - PL - PR);
  }
}