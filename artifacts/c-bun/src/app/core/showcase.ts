import { NgZone, Service, effect, inject, signal, untracked } from '@angular/core';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { ExerciseTracker } from './exercise-tracker';
import { ExerciseConfig } from './exercises';
import { SetRecord } from './models';
import { PlanSession } from './plan-session';
import { SetRecorder } from './set-recorder';
import { BITRATE, LayoutDef, ShowcaseLayoutKind, ShowcaseQuality, dimsFor, layoutFor } from './showcase-layout';
import { Rect, pill, roundRectPath, text } from '../utils/canvas-kit';
import { ChartPainter } from '../utils/chart-canvas';

export interface ShowcaseSource {
  video: HTMLVideoElement;
  mirrored: () => boolean;
  landmarks: () => { x: number; y: number; visibility?: number }[] | null;
  exercise: () => ExerciseConfig;
}

export interface ShowcaseResult {
  url: string; blob: Blob; mime: string; ext: 'mp4' | 'webm';
  sizeMb: string; durationSec: number; exercise: string;
}

export type ShowcasePhase = 'off' | 'live' | 'outro';

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const OUTRO_MS = 4000;
const MIMES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

const pickMime = () => MIMES.find(m => MediaRecorder.isTypeSupported(m));
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sec = (ms: number) => (ms / 1000).toFixed(1) + ' s';
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function endText(reason?: string): string {
  switch (reason) {
    case 'failure': return 'Ended at mechanical failure';
    case 'rest': return 'Ended after a long rest at the top';
    case 'lost': return 'Ended: pose lost';
    case 'timeout': return 'Ended: no movement';
    default: return '';
  }
}

@Service()
export class Showcase {
  private readonly zone = inject(NgZone);
  private readonly rec = inject(SetRecorder);
  private readonly tracker = inject(ExerciseTracker);
  private readonly session = inject(PlanSession);

  readonly supported =
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype;

  readonly enabled = signal(false);
  readonly layout = signal<ShowcaseLayoutKind>('stack');
  readonly quality = signal<ShowcaseQuality>('hd');
  readonly phase = signal<ShowcasePhase>('off');
  readonly result = signal<ShowcaseResult | null>(null);
  readonly error = signal<string | null>(null);

  private source: ShowcaseSource | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private L: LayoutDef | null = null;
  private scale = 1;
  private cfg: ExerciseConfig | null = null;
  private chart = new ChartPainter();
  private plan: { target: number; setNumber: number; setCount: number } | null = null;

  private mr: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private discard = false;
  private raf = 0;
  private lastDraw = 0;
  private startedAt = 0;
  private outroStart = 0;
  private finalSet: SetRecord | null = null;
  private finalElapsed = 0;

  /** Starts/stops recording from the set recorder's state. */
  protected readonly follow = effect(() => {
    const st = this.rec.state();
    untracked(() => this.onState(st));
  });

  attach(src: ShowcaseSource): void { this.source = src; }

  detach(): void {
    this.source = null;
    if (this.phase() === 'outro') this.finish();
    else if (this.phase() === 'live') this.abort();
  }

  clear(): void {
    const r = this.result();
    if (r) URL.revokeObjectURL(r.url);
    this.result.set(null);
  }

  async share(): Promise<void> {
    const r = this.result();
    if (!r) return;
    const file = new File([r.blob], this.fileName(r), { type: r.mime });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'C-bun' });
        return;
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
    this.download();
  }

  download(): void {
    const r = this.result();
    if (!r) return;
    const a = document.createElement('a');
    a.href = r.url;
    a.download = this.fileName(r);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  private fileName(r: ShowcaseResult): string {
    return `c-bun-${r.exercise}-${new Date().toISOString().slice(0, 10)}.${r.ext}`;
  }

  // ---------- state machine ----------

  private onState(st: string): void {
    if (st === 'countdown') {
      if (this.phase() === 'outro') this.finish();
      else if (this.phase() === 'live') this.abort();
      if (this.enabled() && this.source) this.begin();
    } else if (st === 'finished') {
      if (this.phase() === 'live') this.startOutro();
    } else if (st === 'idle') {
      if (this.phase() === 'live') this.abort(); // cancelled during countdown or set
    }
  }

  private begin(): void {
    const src = this.source;
    if (!src) return;
    this.clear();
    this.error.set(null);
    try {
      const kind = this.layout(), q = this.quality();
      const dims = dimsFor(kind, q);
      this.L = layoutFor(kind);
      this.scale = dims.w / this.L.w;

      const cv = this.ensureCanvas();
      cv.width = dims.w;
      cv.height = dims.h;
      this.ctx = cv.getContext('2d', { alpha: false });
      this.chart = new ChartPainter();
      this.cfg = src.exercise();

      const next = this.session.active() ? this.session.next() : null;
      this.plan = next && next.exercise === this.cfg.id
        ? { target: next.targetReps, setNumber: next.setNumber, setCount: next.setCount }
        : null;
      this.finalSet = null;

      this.drawFrame(performance.now());

      const stream = cv.captureStream(FPS);
      const mime = pickMime();
      const mr = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: BITRATE[kind][q],
      });
      this.chunks = [];
      this.discard = false;
      mr.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
      mr.onstop = () => this.onStopped(mr.mimeType || mime || 'video/webm', stream);
      mr.onerror = () => { this.error.set('Video recording failed.'); this.abort(); };
      mr.start(1000);

      this.mr = mr;
      this.startedAt = performance.now();
      this.phase.set('live');
      this.zone.runOutsideAngular(() => {
        this.lastDraw = 0;
        this.raf = requestAnimationFrame(this.loop);
      });
    } catch {
      this.error.set('This browser could not start video recording.');
      this.abort();
    }
  }

  private startOutro(): void {
    this.finalSet = this.rec.result();
    this.finalElapsed = this.rec.elapsedSec();
    this.outroStart = performance.now();
    this.phase.set('outro');
  }

  private finish(): void {
    cancelAnimationFrame(this.raf);
    if (this.mr && this.mr.state !== 'inactive') this.mr.stop();
    this.phase.set('off');
  }

  private abort(): void {
    this.discard = true;
    this.finish();
  }

  private onStopped(type: string, stream: MediaStream): void {
    stream.getTracks().forEach(t => t.stop());
    if (!this.discard && this.chunks.length) {
      const mime = type.split(';')[0];
      const blob = new Blob(this.chunks, { type: mime });
      this.result.set({
        url: URL.createObjectURL(blob), blob, mime,
        ext: mime.includes('mp4') ? 'mp4' : 'webm',
        sizeMb: (blob.size / 1048576).toFixed(1),
        durationSec: Math.round((performance.now() - this.startedAt) / 1000),
        exercise: this.cfg?.id ?? 'set',
      });
    }
    this.chunks = [];
    this.mr = null;
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;pointer-events:none;';
      document.body.appendChild(c);
      this.canvas = c;
    }
    return this.canvas;
  }

  private readonly loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (now - this.lastDraw < FRAME_MS - 2) return;
    this.lastDraw = now;
    this.drawFrame(now);
    if (this.phase() === 'outro' && now - this.outroStart >= OUTRO_MS) this.finish();
  };

  // ---------- drawing (design units; the context is pre-scaled) ----------

  private drawFrame(now: number): void {
    const ctx = this.ctx, L = this.L, cfg = this.cfg;
    if (!ctx || !L || !cfg) return;

    const outro = this.phase() === 'outro';
    const fs = outro ? this.finalSet : null;
    const points = fs ? fs.trace : this.rec.livePoints();
    const segments = fs ? (fs.segments ?? []) : this.rec.liveSegments();
    const reps = fs ? fs.reps : this.rec.reps();
    const nowMs = fs ? (points.length ? points[points.length - 1].t : 0) : this.rec.liveNowMs();
    const counted = reps.filter(r => r.counted);
    const st = this.rec.state();

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = '#090c12';
    ctx.fillRect(0, 0, L.w, L.h);

    this.drawHeader(ctx, L.header, cfg);
    this.drawCamera(ctx, L.camera);
    if (st === 'countdown') this.drawCountdown(ctx, L.camera);

    this.drawCounter(
      ctx, L.counter, counted.length,
      counted.length ? counted[counted.length - 1].totalMs : null,
    );
    this.chart.draw(ctx, L.graph, { points, reps, segments, thresholds: cfg.thresholds, nowMs, final: outro && !!fs });
    this.drawFooter(ctx, L.footer, outro ? this.finalElapsed : this.rec.elapsedSec());

    if (outro) this.drawOutro(ctx, L, now, fs ?? null, counted.map(r => r), cfg);
  }

  private drawHeader(ctx: CanvasRenderingContext2D, r: Rect, cfg: ExerciseConfig): void {
    text(ctx, 'C-bun', r.x, r.y + r.h * 0.68, 46, '#00e5a0', { weight: 800 });
    const mode = this.rec.mode() === 'max' ? 'MAX TEST' : 'FREE SET';
    text(ctx, `${cfg.label.toUpperCase()}  ·  ${mode}`, r.x + r.w, r.y + r.h * 0.66, 30, '#a3acbb',
      { align: 'right', weight: 600 });
  }

  private drawCamera(ctx: CanvasRenderingContext2D, r: Rect): void {
    ctx.save();
    roundRectPath(ctx, r, 24);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();

    const src = this.source;
    const v = src?.video;
    if (src && v && v.videoWidth && v.readyState >= 2) {
      const ar = v.videoWidth / v.videoHeight;
      let w = r.w, h = w / ar;
      if (h > r.h) { h = r.h; w = h * ar; }
      const vr: Rect = { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
      const mirrored = src.mirrored();

      if (mirrored) {
        ctx.save();
        ctx.translate(vr.x + vr.w, vr.y);
        ctx.scale(-1, 1);
        ctx.drawImage(v, 0, 0, vr.w, vr.h);
        ctx.restore();
      } else {
        ctx.drawImage(v, vr.x, vr.y, vr.w, vr.h);
      }
      this.drawSkeleton(ctx, vr, src.landmarks(), mirrored);
    }
    ctx.restore();

    ctx.strokeStyle = '#ffffff14';
    ctx.lineWidth = 2;
    roundRectPath(ctx, r, 24);
    ctx.stroke();

    const angle = this.tracker.angle();
    if (angle !== null && angle !== undefined) {
      pill(ctx, `${Math.round(angle)}°`, r.x + 22, r.y + r.h - 24, 34, '#00e5a0', '#000000aa');
    }
  }

  private drawSkeleton(
    ctx: CanvasRenderingContext2D, vr: Rect,
    lm: { x: number; y: number; visibility?: number }[] | null, mirrored: boolean,
  ): void {
    if (!lm) return;
    const P = (i: number) => {
      const p = lm[i];
      if (!p || (p.visibility ?? 1) < 0.4) return null;
      return { x: vr.x + (mirrored ? 1 - p.x : p.x) * vr.w, y: vr.y + p.y * vr.h };
    };
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00e5a0';
    for (const c of PoseLandmarker.POSE_CONNECTIONS) {
      if (c.start <= 10 || c.end <= 10) continue; // skip face lines
      const a = P(c.start), b = P(c.end);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let i = 11; i < lm.length; i++) {
      const p = P(i);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#00e5a0';
      ctx.stroke();
    }
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, r: Rect): void {
    ctx.fillStyle = '#00000073';
    roundRectPath(ctx, r, 24);
    ctx.fill();
    text(ctx, String(this.rec.countdown()), r.x + r.w / 2, r.y + r.h * 0.62, r.h * 0.5, '#ffffff',
      { align: 'center', weight: 800 });
    text(ctx, 'Get into position', r.x + r.w / 2, r.y + r.h * 0.8, 38, '#e6e9ef',
      { align: 'center', weight: 600 });
  }

  private drawCounter(ctx: CanvasRenderingContext2D, r: Rect, count: number, lastMs: number | null): void {
    roundRectPath(ctx, r, 24);
    ctx.fillStyle = '#11151d';
    ctx.fill();
    ctx.strokeStyle = '#ffffff14';
    ctx.lineWidth = 2;
    ctx.stroke();

    const nx = r.x + 28;
    text(ctx, 'REPS', nx + 2, r.y + r.h * 0.2, r.h * 0.13, '#a3acbb', { weight: 700 });
    const base = r.y + r.h * 0.9;
    let x = nx + text(ctx, String(count), nx, base, r.h * 0.62, '#ffffff', { weight: 800 }) + 14;
    if (this.plan) x += text(ctx, `/ ${this.plan.target}`, x, base, r.h * 0.28, '#a3acbb', { weight: 600 });

    const x0 = Math.max(x + 36, r.x + r.w * 0.4);
    const maxW = r.x + r.w - 24 - x0;
    text(ctx, (this.tracker.phaseLabel() || '').toUpperCase(), x0, r.y + r.h * 0.38, r.h * 0.19, '#00e5a0',
      { weight: 700, maxW });
    text(ctx, lastMs ? `Last rep ${sec(lastMs)}` : 'Waiting for first rep', x0, r.y + r.h * 0.64, r.h * 0.15,
      '#e6e9ef', { weight: 500, maxW });
    const hint = this.tracker.feedback();
    if (hint) pill(ctx, hint, x0, r.y + r.h * 0.9, r.h * 0.13, '#000', '#ffb300', maxW);
  }

  private drawFooter(ctx: CanvasRenderingContext2D, r: Rect, elapsedSec: number): void {
    const y = r.y + r.h * 0.62;
    const left = this.plan
      ? `Planned set ${this.plan.setNumber}/${this.plan.setCount}  ·  target ${this.plan.target} reps`
      : 'Live pose estimation  ·  MediaPipe';
    text(ctx, left, r.x, y, 28, '#a3acbb', { weight: 500 });
    text(ctx, mmss(elapsedSec), r.x + r.w, y, 32, '#e6e9ef', { align: 'right', weight: 700 });
  }

  private drawOutro(
    ctx: CanvasRenderingContext2D, L: LayoutDef, now: number,
    fs: SetRecord | null, counted: { totalMs: number; minAngle: number }[], cfg: ExerciseConfig,
  ): void {
    const a = Math.min(1, (now - this.outroStart) / 400);
    ctx.fillStyle = `rgba(9,12,18,${0.88 * a})`;
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.globalAlpha = a;

    const cx = L.w / 2, cy = L.h / 2;
    const mode = this.rec.mode() === 'max' ? 'MAX TEST' : 'SET COMPLETE';
    text(ctx, 'C-bun', cx, cy - 300, 54, '#00e5a0', { align: 'center', weight: 800 });
    text(ctx, `${cfg.label.toUpperCase()}  ·  ${mode}`, cx, cy - 230, 38, '#e6e9ef', { align: 'center' });
    text(ctx, String(counted.length), cx, cy + 10, 260, '#ffffff', { align: 'center', weight: 800 });
    text(ctx, 'CLEAN REPS', cx, cy + 62, 34, '#a3acbb', { align: 'center', weight: 700 });

    const t = counted.map(r => r.totalMs);
    const cols: [string, string][] = [
      ['Avg rep', t.length ? sec(mean(t)) : '–'],
      ['Fastest', t.length ? sec(Math.min(...t)) : '–'],
      ['Slowest', t.length ? sec(Math.max(...t)) : '–'],
      ['Avg min angle', counted.length ? `${Math.round(mean(counted.map(r => r.minAngle)))}°` : '–'],
    ];
    const colW = 240;
    cols.forEach(([label, value], i) => {
      const x = cx - (colW * cols.length) / 2 + colW * i + colW / 2;
      text(ctx, value, x, cy + 170, 54, '#ffffff', { align: 'center', weight: 700 });
      text(ctx, label, x, cy + 210, 26, '#a3acbb', { align: 'center', weight: 500 });
    });

    const why = endText(fs?.endReason);
    if (why) text(ctx, why, cx, cy + 290, 32, '#ffb300', { align: 'center', weight: 600 });
    text(ctx, 'Counted live with MediaPipe Pose', cx, cy + 380, 26, '#a3acbb', { align: 'center', weight: 500 });
    ctx.globalAlpha = 1;
  }
}