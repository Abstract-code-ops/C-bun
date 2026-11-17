import { RepRecord, Segment, TracePoint } from '../core/models';
import { Thresholds } from './rep-counter';
import { Rect, clamp, roundRectPath, text } from './canvas-kit';

const Y_STEPS = [5, 10, 15, 20, 30, 45, 60];
const T_STEPS = [1, 2, 5, 10, 15, 30, 60];
const GAP_MS = 400;
const SEG_COLOR = { rest: '#4aa3ff', lost: '#ff4d4d', stall: '#ffb300' } as const;
const SEG_ALPHA = { rest: 0.16, lost: 0.22, stall: 0.24 } as const;
const SEG_SHORT = { rest: 'rest', lost: 'no pose', stall: 'stalled' } as const;

export interface ChartInput {
  points: TracePoint[];
  reps: RepRecord[];
  segments: Segment[];
  thresholds: Thresholds | null;
  nowMs: number;
  /** true: show the whole set; false: expanding live window (max 20 s, then scrolling). */
  final: boolean;
}

export class ChartPainter {
  private ymin: number | null = null;
  private ymax: number | null = null;

  draw(ctx: CanvasRenderingContext2D, r: Rect, d: ChartInput): void {
    const fs = clamp(r.h * 0.085, 20, 28);
    const plot: Rect = { x: r.x + fs * 3.4, y: r.y + fs * 2, w: r.w - fs * 3.4 - 24, h: r.h - fs * 2 - fs * 2.2 };

    // ---- x domain
    const last = d.points.length ? d.points[d.points.length - 1].t : 0;
    let t0: number, t1: number;
    if (d.final) {
      const segEnd = d.segments.reduce((m, s) => Math.max(m, s.endMs), 0);
      t0 = 0;
      t1 = Math.max(1000, last, segEnd);
    } else {
      const end = Math.max(last, d.nowMs);
      t1 = Math.max(8000, end + 1200);
      t0 = Math.max(0, t1 - 20000);
    }

    // ---- y range, eased so the picture doesn't jump
    const target = this.targetRange(d, t0, t1);
    if (this.ymin === null || this.ymax === null) {
      this.ymin = target.min;
      this.ymax = target.max;
    } else {
      this.ymin += (target.min - this.ymin) * 0.12;
      this.ymax += (target.max - this.ymax) * 0.12;
    }
    const lo = this.ymin, hi = Math.max(this.ymax, lo + 1);
    const xOf = (t: number) => plot.x + ((t - t0) / Math.max(1, t1 - t0)) * plot.w;
    const yOf = (a: number) => plot.y + (1 - (clamp(a, lo, hi) - lo) / (hi - lo)) * plot.h;

    ctx.save();
    roundRectPath(ctx, r, 24);
    ctx.fillStyle = '#0e1116';
    ctx.fill();
    ctx.strokeStyle = '#ffffff14';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- grid + y labels
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff1f';
    for (let v = Math.ceil(lo / target.step) * target.step; v <= hi; v += target.step) {
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
      text(ctx, `${v}°`, plot.x - 12, y + fs * 0.35, fs, '#ffffffaa', { align: 'right', weight: 500 });
    }

    // ---- x labels
    const span = (t1 - t0) / 1000;
    const tStep = T_STEPS.find(s => span / s <= 6) ?? 120;
    for (let s = Math.ceil(t0 / 1000 / tStep) * tStep; s * 1000 <= t1; s += tStep) {
      text(ctx, `${s}s`, xOf(s * 1000), r.y + r.h - fs * 0.6, fs, '#ffffffaa', { align: 'center', weight: 500 });
    }

    // ---- plot area (clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();

    for (const s of d.segments) {
      if (s.endMs <= t0 || s.startMs >= t1) continue;
      const x0 = xOf(Math.max(s.startMs, t0)), x1 = xOf(Math.min(s.endMs, t1));
      ctx.globalAlpha = SEG_ALPHA[s.kind];
      ctx.fillStyle = SEG_COLOR[s.kind];
      ctx.fillRect(x0, plot.y, Math.max(1, x1 - x0), plot.h);
      ctx.globalAlpha = 1;
      if (x1 - x0 > fs * 4) text(ctx, SEG_SHORT[s.kind], x0 + 8, plot.y + plot.h - 10, fs * 0.8, '#ffffffbb', { weight: 500 });
    }

    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffb300d9';
    const th = d.thresholds;
    if (th) {
      for (const v of [th.topEnter, th.depthTarget ?? th.bottomEnter]) {
        const y = yOf(v);
        ctx.beginPath();
        ctx.moveTo(plot.x, y);
        ctx.lineTo(plot.x + plot.w, y);
        ctx.stroke();
      }
    }

    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    const marks: { x: number; label: string; color: string; bold: boolean }[] = [];
    for (const rep of d.reps) {
      if (rep.endMs < t0 || rep.endMs > t1) continue;
      const x = xOf(rep.endMs);
      const failed = !!rep.failed;
      ctx.strokeStyle = failed ? '#ff4d4d' : rep.counted ? '#ffffff44' : '#ff4d4d88';
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
      marks.push({
        x, bold: failed,
        label: failed ? 'F' : rep.counted ? String(rep.index) : '×',
        color: failed ? '#ff6b6b' : rep.counted ? '#ffffffcc' : '#ff8a8a',
      });
    }
    ctx.setLineDash([]);

    // curve
    ctx.beginPath();
    let prev: number | null = null;
    for (const p of d.points) {
      if (p.t < t0 - 300) continue;
      if (p.t > t1 + 300) break;
      const x = xOf(p.t), y = yOf(p.a);
      if (prev === null || p.t - prev > GAP_MS) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prev = p.t;
    }
    ctx.lineWidth = Math.max(6, r.h * 0.03);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00e5a0';
    ctx.shadowColor = '#00e5a0aa';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore(); // end clip

    for (const m of marks) {
      if (m.x >= plot.x && m.x <= plot.x + plot.w) {
        text(ctx, m.label, m.x, plot.y - fs * 0.4, fs, m.color, { align: 'center', weight: m.bold ? 800 : 600 });
      }
    }

    const tail = d.points[d.points.length - 1];
    if (!d.final && tail && tail.t >= t0) {
      ctx.beginPath();
      ctx.arc(xOf(tail.t), yOf(tail.a), fs * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5a0';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0e1116';
      ctx.stroke();
    }
    ctx.restore();
  }

  private targetRange(d: ChartInput, t0: number, t1: number) {
    let lo = Infinity, hi = -Infinity;
    for (const p of d.points) {
      if (p.t < t0 || p.t > t1) continue;
      if (p.a < lo) lo = p.a;
      if (p.a > hi) hi = p.a;
    }
    const th = d.thresholds;
    if (th) {
      lo = Math.min(lo, th.depthTarget ?? th.bottomEnter);
      hi = Math.max(hi, th.topEnter);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 60; hi = 180; }
    const pad = Math.max(6, (hi - lo) * 0.12);
    const rawLo = lo - pad, rawHi = hi + pad;
    const step = Y_STEPS.find(s => (rawHi - rawLo) / s <= 6) ?? 60;
    let min = Math.max(0, Math.floor(rawLo / step) * step);
    let max = Math.min(180, Math.ceil(rawHi / step) * step);
    if (max - min < 30) { max = Math.min(180, min + 30); min = Math.max(0, max - 30); }
    return { min, max, step };
  }
}