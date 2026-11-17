import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { RepRecord, Segment, TracePoint } from '../../core/models';
import { Thresholds } from '../../utils/rep-counter';

const W = 600, H = 460;
const PL = 52, PR = 14, PT = 24, PB = 34;
const PLOT_W = W - PL - PR, PLOT_H = H - PT - PB;
const GAP_MS = 400;
const MIN_SPAN_MS = 2000;
const Y_STEPS = [5, 10, 15, 20, 30, 45, 60];
const T_STEPS = [1, 2, 5, 10, 15, 30, 60];
const PHASE_LABEL = ['At top', 'Closing', 'At bottom', 'Opening'];
const SEG_LABEL = { rest: 'Rest at top', lost: 'No pose', stall: 'Stalled' } as const;
const SEG_SHORT = { rest: 'rest', lost: 'no pose', stall: 'stalled' } as const;

interface Domain { t0: number; t1: number }
interface YRange { min: number; max: number; step: number }

@Component({
  selector: 'app-motion-chart',
  template: `
    <svg #svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Joint angle over time"
         (pointerdown)="onDown($event)" (pointermove)="onMove($event)" (pointerup)="onUp($event)"
         (pointercancel)="onCancel()" (pointerleave)="onLeave($event)" (wheel)="onWheel($event)"
         (dblclick)="fit()">
      <defs>
        <clipPath [attr.id]="clipId">
          <rect [attr.x]="PL" [attr.y]="PT" [attr.width]="PLOT_W" [attr.height]="PLOT_H" />
        </clipPath>
      </defs>

      @for (g of yTicks(); track g.v) {
        <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="g.y" [attr.y2]="g.y" class="grid" />
        <text [attr.x]="PL - 6" [attr.y]="g.y + 5" class="lbl end">{{ g.v }}°</text>
      }
      @for (t of xTicks(); track t.label) {
        <text [attr.x]="t.x" [attr.y]="H - 10" class="lbl mid">{{ t.label }}</text>
      }

      <g [attr.clip-path]="'url(#' + clipId + ')'">
        @for (b of bands(); track $index) {
          <rect [attr.x]="b.x" [attr.y]="PT" [attr.width]="b.w" [attr.height]="PLOT_H"
                [attr.class]="'band ' + b.kind" />
          @if (b.label) {
            <text [attr.x]="b.x + 4" [attr.y]="PT + PLOT_H - 6" class="bandlbl">{{ b.label }}</text>
          }
        }
        @for (l of limits(); track l.v) {
          <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="l.y" [attr.y2]="l.y" class="limit" />
        }
        @for (m of markers(); track m.key) {
          <line [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="PT" [attr.y2]="PT + PLOT_H"
                [attr.class]="'rep ' + m.cls" />
          <text [attr.x]="m.x" [attr.y]="PT + 17" [attr.class]="'lbl mid ' + m.cls">{{ m.label }}</text>
        }
        <path [attr.d]="path()" class="curve" />
      </g>

      @if (lastDot(); as d) { <circle [attr.cx]="d.x" [attr.cy]="d.y" r="6.5" class="live-dot" /> }

      @if (cursor(); as c) {
        <line [attr.x1]="c.x" [attr.x2]="c.x" [attr.y1]="PT" [attr.y2]="PT + PLOT_H" class="cursor" />
        <circle [attr.cx]="c.x" [attr.cy]="c.y" r="6.5" class="cursor-dot" />
        <rect [attr.x]="c.boxX" [attr.y]="c.boxY" [attr.width]="c.boxW" [attr.height]="c.boxH" rx="8" class="tip" />
        @for (l of c.lines; track $index) {
          <text [attr.x]="c.boxX + 8" [attr.y]="c.boxY + 20 + $index * 19" class="tiptext">{{ l }}</text>
        }
      }
    </svg>

    <div class="bar">
      <div class="legend">
        @for (l of legend(); track l.kind) { <span class="chip" [attr.data-kind]="l.kind">{{ l.label }}</span> }
      </div>
      @if (!live() && points().length) {
        <div class="zoom">
          <button type="button" (click)="zoomBy(2)" aria-label="Zoom out">−</button>
          <button type="button" (click)="zoomBy(0.5)" aria-label="Zoom in">+</button>
          <button type="button" (click)="fit()" [disabled]="!isZoomed()">Fit</button>
        </div>
      }
    </div>
    <p class="hint">{{ live()
      ? 'Tap the graph to inspect a moment.'
      : 'Tap to inspect · pinch or +/− to zoom · drag to pan when zoomed' }}</p>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; background: #0e1116; border-radius: 10px;
          touch-action: pan-y; user-select: none; -webkit-user-select: none; cursor: crosshair; }
    .grid { stroke: #ffffff1f; stroke-width: 1.5; }
    .limit { stroke: #ffb300; stroke-width: 2; stroke-dasharray: 8 6; opacity: .85; }
    .rep { stroke: #ffffff44; stroke-width: 2; stroke-dasharray: 3 4; }
    .rep.partial { stroke: #ff4d4d88; }
    .rep.failed { stroke: #ff4d4d; stroke-dasharray: none; stroke-width: 3; }
    .curve { fill: none; stroke: #00e5a0; stroke-width: 5; stroke-linejoin: round; stroke-linecap: round; }
    .lbl { fill: #ffffffaa; font: 15px system-ui; }
    .lbl.failed { fill: #ff6b6b; font-weight: 700; }
    .end { text-anchor: end; }
    .mid { text-anchor: middle; }
    .band.rest { fill: #4aa3ff; opacity: .16; }
    .band.lost { fill: #ff4d4d; opacity: .22; }
    .band.stall { fill: #ffb300; opacity: .24; }
    .bandlbl { fill: #ffffffbb; font: 14px system-ui; }
    .live-dot { fill: #00e5a0; stroke: #0e1116; stroke-width: 3; }
    .cursor { stroke: #ffffffaa; stroke-width: 1.5; }
    .cursor-dot { fill: #fff; stroke: #00e5a0; stroke-width: 3; }
    .tip { fill: #1b2230; stroke: #ffffff33; }
    .tiptext { fill: #fff; font: 15px system-ui; }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .legend { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid; }
    .chip[data-kind='rest'] { border-color: #4aa3ff; background: #4aa3ff22; }
    .chip[data-kind='lost'] { border-color: #ff4d4d; background: #ff4d4d22; }
    .chip[data-kind='stall'] { border-color: #ffb300; background: #ffb30022; }
    .zoom { display: flex; gap: 6px; }
    .zoom button { min-width: 40px; padding: 6px 10px; border-radius: 8px; border: 1px solid #8886; background: transparent; color: inherit; font-size: 15px; }
    .zoom button:disabled { opacity: .4; }
    .hint { margin: 4px 0 0; font-size: 12px; opacity: .65; }
  `,
})
export class MotionChart {
  readonly points = input.required<TracePoint[]>();
  readonly thresholds = input<Thresholds | null>(null);
  readonly reps = input<RepRecord[]>([]);
  readonly segments = input<Segment[]>([]);
  /** Live mode: show a sliding window of this many ms that follows the latest data. */
  readonly windowMs = input<number | null>(null);
  /** Live mode: current set time, so the window keeps scrolling when tracking is lost. */
  readonly nowMs = input<number | null>(null);

  protected readonly W = W; protected readonly H = H;
  protected readonly PL = PL; protected readonly PR = PR; protected readonly PT = PT;
  protected readonly PLOT_W = PLOT_W; protected readonly PLOT_H = PLOT_H;
  protected readonly clipId = 'plot-' + Math.random().toString(36).slice(2);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly view = signal<Domain | null>(null);
  private readonly cursorT = signal<number | null>(null);

  protected readonly live = computed(() => !!this.windowMs());
  protected readonly isZoomed = computed(() => !this.live() && this.view() !== null);

  private readonly fullDomain = computed<Domain>(() => {
    const pts = this.points();
    const last = pts.length ? pts[pts.length - 1].t : 0;
    const win = this.windowMs();
    if (win) {
      const end = Math.max(last, this.nowMs() ?? 0);
      const t0 = Math.max(0, end - win);
      return { t0, t1: t0 + win };
    }
    const segEnd = this.segments().reduce((m, s) => Math.max(m, s.endMs), 0);
    return { t0: 0, t1: Math.max(1000, last, segEnd) };
  });

  protected readonly domain = computed<Domain>(() =>
    (this.live() ? null : this.view()) ?? this.fullDomain());

  private readonly visible = computed(() => {
    const d = this.domain();
    return this.points().filter(p => p.t >= d.t0 && p.t <= d.t1);
  });

  /** Y range fits the visible data plus the thresholds, padded, snapped to round numbers. */
  protected readonly yRange = computed<YRange>(() => {
    let lo = Infinity, hi = -Infinity;
    for (const p of this.visible()) { if (p.a < lo) lo = p.a; if (p.a > hi) hi = p.a; }
    const th = this.thresholds();
    if (th) { lo = Math.min(lo, th.depthTarget ?? th.bottomEnter); hi = Math.max(hi, th.topEnter); }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 60; hi = 180; }
    const pad = Math.max(6, (hi - lo) * 0.12);
    const rawLo = lo - pad, rawHi = hi + pad;
    const step = Y_STEPS.find(s => (rawHi - rawLo) / s <= 6) ?? 60;
    let min = Math.max(0, Math.floor(rawLo / step) * step);
    let max = Math.min(180, Math.ceil(rawHi / step) * step);
    if (max - min < 30) { max = Math.min(180, min + 30); min = Math.max(0, max - 30); }
    return { min, max, step };
  });

  protected readonly yTicks = computed(() => {
    const r = this.yRange();
    const out: { v: number; y: number }[] = [];
    for (let v = Math.ceil(r.min / r.step) * r.step; v <= r.max; v += r.step) out.push({ v, y: this.yOf(v, r) });
    return out;
  });

  protected readonly xTicks = computed(() => {
    const d = this.domain();
    const span = (d.t1 - d.t0) / 1000;
    const step = T_STEPS.find(s => span / s <= 6) ?? 120;
    const out: { x: number; label: string }[] = [];
    for (let s = Math.ceil(d.t0 / 1000 / step) * step; s * 1000 <= d.t1; s += step) {
      out.push({ x: this.xOf(s * 1000, d), label: `${s}s` });
    }
    return out;
  });

  protected readonly path = computed(() => {
    const d = this.domain(), r = this.yRange();
    let out = '';
    let prev: number | null = null;
    for (const p of this.points()) {
      if (p.t < d.t0 - 300) continue;
      if (p.t > d.t1 + 300) break;
      const cmd = prev === null || p.t - prev > GAP_MS ? 'M' : 'L';
      out += `${cmd}${this.xOf(p.t, d).toFixed(1)} ${this.yOf(p.a, r).toFixed(1)} `;
      prev = p.t;
    }
    return out;
  });

  protected readonly limits = computed(() => {
    const th = this.thresholds(), r = this.yRange();
    return th ? [th.topEnter, th.depthTarget ?? th.bottomEnter].map(v => ({ v, y: this.yOf(v, r) })) : [];
  });

  protected readonly bands = computed(() => {
    const d = this.domain();
    return this.segments()
      .filter(s => s.endMs > d.t0 && s.startMs < d.t1)
      .map(s => {
        const x0 = this.xOf(Math.max(s.startMs, d.t0), d);
        const x1 = this.xOf(Math.min(s.endMs, d.t1), d);
        return { kind: s.kind, x: x0, w: Math.max(1, x1 - x0), label: x1 - x0 > 56 ? SEG_SHORT[s.kind] : '' };
      });
  });

  protected readonly markers = computed(() => {
    const d = this.domain();
    return this.reps()
      .filter(r => r.endMs >= d.t0 && r.endMs <= d.t1)
      .map(r => ({
        key: r.endMs,
        x: this.xOf(r.endMs, d),
        label: r.failed ? 'F' : r.counted ? String(r.index) : '×',
        cls: r.failed ? 'failed' : r.counted ? 'ok' : 'partial',
      }));
  });

  protected readonly legend = computed(() => {
    const kinds = new Set(this.segments().map(s => s.kind));
    return (['rest', 'lost', 'stall'] as const)
      .filter(k => kinds.has(k)).map(k => ({ kind: k, label: SEG_LABEL[k] }));
  });

  protected readonly lastDot = computed(() => {
    if (!this.live()) return null;
    const v = this.visible();
    const p = v[v.length - 1];
    return p ? { x: this.xOf(p.t), y: this.yOf(p.a) } : null;
  });

  protected readonly cursor = computed(() => {
    const t = this.cursorT();
    if (t === null) return null;
    const d = this.domain();
    if (t < d.t0 || t > d.t1) return null;
    const p = this.nearest(this.points(), t);
    if (!p) return null;

    const lines = [`${(p.t / 1000).toFixed(1)}s · ${p.a.toFixed(0)}°`];
    if (p.p !== undefined && PHASE_LABEL[p.p]) lines.push(PHASE_LABEL[p.p]);
    const seg = this.segments().find(s => p.t >= s.startMs && p.t <= s.endMs);
    if (seg) lines.push(`${SEG_LABEL[seg.kind]} · ${((seg.endMs - seg.startMs) / 1000).toFixed(1)}s`);
    const rep = this.reps().find(r => p.t <= r.endMs && p.t >= r.endMs - r.totalMs);
    if (rep) {
      lines.push(rep.failed ? `Failed attempt · min ${rep.minAngle}°`
        : rep.counted ? `Rep ${rep.index} · ${(rep.totalMs / 1000).toFixed(1)}s · min ${rep.minAngle}°`
        : `Partial · min ${rep.minAngle}°`);
    }
    const x = this.xOf(p.t, d), y = this.yOf(p.a);
    const boxW = 168, boxH = 10 + lines.length * 14;
    return { x, y, lines, boxW, boxH, boxX: x > W / 2 ? x - boxW - 8 : x + 8, boxY: PT + 4 };
  });

  // ---------- zoom / pan / inspect ----------

  protected zoomBy(factor: number, centerT?: number): void {
    const d = this.domain();
    const c = centerT ?? (d.t0 + d.t1) / 2;
    const span = (d.t1 - d.t0) * factor;
    const frac = (c - d.t0) / (d.t1 - d.t0);
    this.setView(c - frac * span, c - frac * span + span);
  }

  protected fit(): void { this.view.set(null); }

  private setView(t0: number, t1: number): void {
    if (this.live()) return;
    const full = this.fullDomain();
    const fullSpan = full.t1 - full.t0;
    const span = Math.min(Math.max(t1 - t0, MIN_SPAN_MS), fullSpan);
    const a = Math.max(full.t0, Math.min(t0, full.t1 - span));
    this.view.set(span >= fullSpan - 1 ? null : { t0: a, t1: a + span });
  }

  private readonly pointers = new Map<number, number>(); // pointerId -> x in viewBox units
  private pinch: { dist: number; t0: number; t1: number; cx: number } | null = null;
  private lastClientX = 0;
  private downClientX = 0;
  private dragged = false;
  private reanchor = false;

  protected onDown(ev: PointerEvent): void {
    this.svgRef().nativeElement.setPointerCapture(ev.pointerId);
    this.pointers.set(ev.pointerId, this.vbX(ev));
    this.dragged = false;
    this.downClientX = this.lastClientX = ev.clientX;
    if (this.pointers.size === 2 && !this.live()) this.startPinch();
    else if (this.pointers.size === 1) this.placeCursor(ev);
  }

  protected onMove(ev: PointerEvent): void {
    const isDown = this.pointers.has(ev.pointerId);
    if (isDown) this.pointers.set(ev.pointerId, this.vbX(ev));

    if (this.pinch && this.pointers.size >= 2) { this.updatePinch(); this.dragged = true; return; }

    const pressed = isDown && (ev.pointerType !== 'mouse' || ev.buttons === 1);
    if (pressed && this.isZoomed()) {
      if (this.reanchor) { this.lastClientX = this.downClientX = ev.clientX; this.reanchor = false; }
      if (Math.abs(ev.clientX - this.downClientX) > 6) this.dragged = true;
      if (this.dragged) this.panByPx(ev.clientX - this.lastClientX);
      this.lastClientX = ev.clientX;
      return;
    }
    if (pressed || ev.pointerType === 'mouse') this.placeCursor(ev);
  }

  protected onUp(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 1) this.reanchor = true;
  }

  protected onCancel(): void { this.pointers.clear(); this.pinch = null; }

  protected onLeave(ev: PointerEvent): void {
    if (ev.pointerType === 'mouse') this.cursorT.set(null);
  }

  protected onWheel(ev: WheelEvent): void {
    if (this.live() || !(ev.ctrlKey || ev.metaKey)) return; // plain scroll still scrolls the page
    ev.preventDefault();
    this.zoomBy(Math.exp(ev.deltaY * 0.01), this.tAt(this.vbX(ev)));
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    const d = this.domain();
    this.pinch = { dist: Math.abs(a - b) || 1, t0: d.t0, t1: d.t1, cx: (a + b) / 2 };
  }

  private updatePinch(): void {
    const p = this.pinch;
    if (!p) return;
    const [a, b] = [...this.pointers.values()];
    const dist = Math.abs(a - b) || 1;
    const cx = (a + b) / 2;
    const span0 = p.t1 - p.t0;
    const tCenter = p.t0 + ((p.cx - PL) / PLOT_W) * span0;
    const span = span0 * (p.dist / dist);
    const t0 = tCenter - ((cx - PL) / PLOT_W) * span;
    this.setView(t0, t0 + span);
  }

  private panByPx(dx: number): void {
    const r = this.svgRef().nativeElement.getBoundingClientRect();
    const plotPx = r.width * (PLOT_W / W);
    const d = this.domain();
    const dt = -(dx / plotPx) * (d.t1 - d.t0);
    this.setView(d.t0 + dt, d.t1 + dt);
  }

  private placeCursor(ev: { clientX: number }): void {
    const d = this.domain();
    this.cursorT.set(Math.min(d.t1, Math.max(d.t0, this.tAt(this.vbX(ev)))));
  }

  // ---------- geometry ----------

  private vbX(ev: { clientX: number }): number {
    const r = this.svgRef().nativeElement.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * W;
  }

  private tAt(vx: number): number {
    const d = this.domain();
    return d.t0 + ((vx - PL) / PLOT_W) * (d.t1 - d.t0);
  }

  protected xOf(t: number, d: Domain = this.domain()): number {
    return PL + ((t - d.t0) / Math.max(1, d.t1 - d.t0)) * PLOT_W;
  }

  protected yOf(a: number, r: YRange = this.yRange()): number {
    const c = Math.min(r.max, Math.max(r.min, a));
    return PT + (1 - (c - r.min) / (r.max - r.min)) * PLOT_H;
  }

  private nearest(pts: TracePoint[], t: number): TracePoint | null {
    if (!pts.length) return null;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t < t) lo = mid + 1; else hi = mid;
    }
    const a = pts[Math.max(0, lo - 1)], b = pts[lo];
    return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
  }
}
