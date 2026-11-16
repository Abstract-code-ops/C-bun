import { Service, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ExerciseTracker } from './exercise-tracker';
import { ExerciseConfig } from './exercises';
import {
  EndReason, PHASE_ORDER, RepRecord, Segment, SetMode, SetRecord, TracePoint, countedReps,
} from './models';
import { Phase, RepEvent } from '../utils/rep-counter';
import { Store } from './store';

export type RecorderState = 'idle' | 'countdown' | 'recording' | 'finished';

const SAMPLE_MS = 66;            // ~15 Hz stored trace
const LIVE_WINDOW_MS = 15_000;
const MAX_SET_MS = 10 * 60_000;

// Rest at the top
const REST_MIN_MS = 1_000;       // log a rest if you hold the top at least this long
const REST_END_MS = 10_000;      // max test ends after resting this long at the top
const START_TIMEOUT_MS = 30_000; // max test ends if you never start moving

// Tracking
const LOST_GAP_MS = 500;         // no samples for this long = "no pose"
const LOST_END_MS = 6_000;       // max test ends after this long without a pose

// Mechanical failure = movement stalls mid-rep
const STALL_DELTA = 4;           // degrees of movement that count as progress
const STALL_MS = 1_500;          // stalled while closing or opening
const BOTTOM_STALL_MS = 3_000;   // staying at the bottom

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

@Service()
export class SetRecorder {
  private readonly tracker = inject(ExerciseTracker);
  private readonly store = inject(Store);

  readonly state = signal<RecorderState>('idle');
  readonly mode = signal<SetMode>('free');
  readonly countdown = signal(0);
  readonly elapsedSec = signal(0);
  readonly reps = signal<RepRecord[]>([]);
  readonly livePoints = signal<TracePoint[]>([]);
  readonly liveSegments = signal<Segment[]>([]);
  readonly liveNowMs = signal(0);
  readonly result = signal<SetRecord | null>(null);

  private exercise: ExerciseConfig | null = null;
  private subs: Subscription[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private startedAt = 0;
  private lastStoredT = -Infinity;
  private trace: TracePoint[] = [];

  private segments: Segment[] = [];
  private lastSampleAbs = 0;
  private lostStart: number | null = null;
  private moved = false;
  private restStart: number | null = null;
  private wasTop = true;
  private lastPhase: Phase = 'top';
  private attemptStart = 0;
  private attemptMin = 180;
  private refAngle = 0;
  private progressT = 0;
  private openStall: Segment | null = null;

  start(exercise: ExerciseConfig, mode: SetMode): void {
    if (this.state() === 'countdown' || this.state() === 'recording') return;
    this.cleanup();
    this.exercise = exercise;
    this.mode.set(mode);
    this.result.set(null);
    this.reps.set([]);
    this.livePoints.set([]);
    this.liveSegments.set([]);
    this.elapsedSec.set(0);
    this.state.set('countdown');

    let n = 3;
    this.countdown.set(n);
    this.timer = setInterval(() => {
      n--;
      if (n > 0) { this.countdown.set(n); return; }
      this.cleanup();
      this.begin();
    }, 1000);
  }

  end(reason: EndReason = 'manual'): void {
    const s = this.state();
    if (s === 'countdown') { this.cleanup(); this.state.set('idle'); return; }
    if (s !== 'recording' || !this.exercise) return;

    const durationMs = Math.round(performance.now() - this.t0);
    this.closeOpen(durationMs);
    this.cleanup();
    this.result.set({
      id: uid(),
      exerciseId: this.exercise.id,
      mode: this.mode(),
      startedAt: this.startedAt,
      durationMs,
      reps: this.reps(),
      trace: this.trace,
      segments: this.segments.map(x => ({ ...x })),
      endReason: reason,
    });
    this.state.set('finished');
  }

  save(asMax: boolean): void {
    const r = this.result();
    if (!r) return;
    this.store.addSet(r);
    if (asMax) {
      this.store.setMax({ exerciseId: r.exerciseId, reps: countedReps(r), setId: r.id, date: r.startedAt });
    }
    this.discard();
  }

  discard(): void {
    this.result.set(null);
    this.reps.set([]);
    this.livePoints.set([]);
    this.liveSegments.set([]);
    this.state.set('idle');
  }

  // ---------- internals ----------

  private begin(): void {
    this.tracker.start(this.exercise!);
    this.t0 = performance.now();
    this.startedAt = Date.now();
    this.lastSampleAbs = this.t0;
    this.lastStoredT = -Infinity;
    this.trace = [];
    this.segments = [];
    this.lostStart = null;
    this.moved = false;
    this.restStart = null;
    this.wasTop = true;
    this.lastPhase = 'top';
    this.attemptStart = 0;
    this.attemptMin = 180;
    this.refAngle = 0;
    this.progressT = 0;
    this.openStall = null;
    this.liveSegments.set([]);
    this.liveNowMs.set(0);
    this.state.set('recording');
    this.subs.push(
      this.tracker.sample$.subscribe(s => this.onSample(s.t, s.angle, s.phase)),
      this.tracker.rep$.subscribe(e => this.onRep(e)),
    );
    this.timer = setInterval(() => this.tick(), 250);
  }

  private onSample(ts: number, angle: number, phase: Phase): void {
    const t = ts - this.t0;
    if (t < 0 || !this.exercise) return;
    const th = this.exercise.thresholds;
    this.lastSampleAbs = ts;

    // Tracking resumed after a gap: log it
    if (this.lostStart !== null) {
      this.segments.push({ kind: 'lost', startMs: Math.round(this.lostStart), endMs: Math.round(t) });
      this.lostStart = null;
      this.progressT = t; this.refAngle = angle; this.openStall = null;
    }

    // "Top zone" = at the top, or still above the exit threshold
    const inTop = phase === 'top' || angle >= th.topExit;

    // Rest at the top (only counted after the first movement)
    if (inTop) {
      if (this.moved && this.restStart === null) this.restStart = t;
    } else {
      this.moved = true;
      this.closeRest(t);
    }

    // The current attempt: from leaving the top zone until returning
    if (!inTop) {
      if (this.wasTop) { this.attemptStart = t; this.attemptMin = angle; }
      else this.attemptMin = Math.min(this.attemptMin, angle);
    }
    this.wasTop = inTop;

    // Stall detection (mechanical failure)
    const phaseChanged = phase !== this.lastPhase;
    this.lastPhase = phase;
    if (inTop || phaseChanged || Math.abs(angle - this.refAngle) >= STALL_DELTA) {
      this.refAngle = angle;
      this.progressT = t;
      this.openStall = null;
    }
    if (!inTop) {
      const limit = phase === 'bottom' ? BOTTOM_STALL_MS : STALL_MS;
      if (t - this.progressT >= limit) {
        this.onStall(t);
        if (this.state() !== 'recording') return;
      }
    }

    // Store the trace point (throttled)
    if (t - this.lastStoredT < SAMPLE_MS) return;
    this.lastStoredT = t;
    const p: TracePoint = { t: Math.round(t), a: Math.round(angle * 10) / 10, p: PHASE_ORDER.indexOf(phase) };
    this.trace.push(p);
    this.livePoints.update(prev => {
      const cutoff = t - LIVE_WINDOW_MS;
      let i = 0;
      while (i < prev.length && prev[i].t < cutoff) i++;
      return [...prev.slice(i), p];
    });
  }

  private onStall(t: number): void {
    if (this.mode() === 'max') {
      this.reps.update(list => [...list, {
        index: 0, counted: false, gateMissed: false, failed: true,
        minAngle: Math.round(this.attemptMin), downMs: 0, upMs: 0,
        totalMs: Math.round(t - this.attemptStart), endMs: Math.round(t),
      }]);
      this.segments.push({ kind: 'stall', startMs: Math.round(this.progressT), endMs: Math.round(t) });
      this.end('failure');
      return;
    }
    // Free set: just log it
    if (!this.openStall) {
      this.openStall = { kind: 'stall', startMs: Math.round(this.progressT), endMs: Math.round(t) };
      this.segments.push(this.openStall);
    } else {
      this.openStall.endMs = Math.round(t);
    }
  }

  private onRep(e: RepEvent): void {
    this.reps.update(list => [...list, {
      index: e.counted ? e.index : 0,
      counted: e.counted,
      gateMissed: e.gateMissed,
      minAngle: Math.round(e.minAngle),
      downMs: Math.round(e.downMs),
      upMs: Math.round(e.upMs),
      totalMs: Math.round(e.totalMs),
      endMs: Math.round(e.endedAt - this.t0),
    }]);
  }

  private closeRest(t: number): void {
    if (this.restStart !== null && t - this.restStart >= REST_MIN_MS) {
      this.segments.push({ kind: 'rest', startMs: Math.round(this.restStart), endMs: Math.round(t) });
    }
    this.restStart = null;
  }

  private closeOpen(rel: number): void {
    if (this.lostStart !== null) {
      this.segments.push({ kind: 'lost', startMs: Math.round(this.lostStart), endMs: Math.round(rel) });
      this.lostStart = null;
    }
    this.closeRest(rel);
  }

  private publishSegments(rel: number): void {
    const out = this.segments.map(s => ({ ...s }));
    if (this.restStart !== null && rel - this.restStart >= REST_MIN_MS) {
      out.push({ kind: 'rest', startMs: Math.round(this.restStart), endMs: Math.round(rel) });
    }
    if (this.lostStart !== null) {
      out.push({ kind: 'lost', startMs: Math.round(this.lostStart), endMs: Math.round(rel) });
    }
    this.liveSegments.set(out);
  }

  private tick(): void {
    const now = performance.now();
    const rel = now - this.t0;
    this.elapsedSec.set(Math.floor(rel / 1000));
    this.liveNowMs.set(Math.round(rel));

    if (this.lostStart === null && now - this.lastSampleAbs > LOST_GAP_MS) {
      this.lostStart = this.lastSampleAbs - this.t0;
    }
    this.publishSegments(rel);

    if (rel > MAX_SET_MS) { this.end('timeout'); return; }
    if (this.mode() !== 'max') return;
    if (this.restStart !== null && rel - this.restStart >= REST_END_MS) { this.end('rest'); return; }
    if (this.lostStart !== null && rel - this.lostStart >= LOST_END_MS) { this.end('lost'); return; }
    if (!this.moved && rel >= START_TIMEOUT_MS) this.end('timeout');
  }

  private cleanup(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }
}