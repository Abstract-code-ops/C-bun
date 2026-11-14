import { Service, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ExerciseTracker } from './exercise-tracker';
import { ExerciseConfig } from './exercises';
import { RepRecord, SetMode, SetRecord, TracePoint, countedReps } from './models';
import { RepEvent } from '../utils/rep-counter';
import { Store } from './store';

export type RecorderState = 'idle' | 'countdown' | 'recording' | 'finished';

const SAMPLE_MS = 66;           // ~15 Hz trace
const LIVE_WINDOW_MS = 12_000;
const IDLE_END_MS = 8_000;      // max test ends after this long with no rep
const MAX_SET_MS = 10 * 60_000; // safety stop

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
  readonly result = signal<SetRecord | null>(null);

  private exercise: ExerciseConfig | null = null;
  private subs: Subscription[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private startedAt = 0;
  private lastRepAt = 0;
  private lastSampleT = -Infinity;
  private trace: TracePoint[] = [];

  start(exercise: ExerciseConfig, mode: SetMode): void {
    if (this.state() === 'countdown' || this.state() === 'recording') return;
    this.cleanup();
    this.exercise = exercise;
    this.mode.set(mode);
    this.result.set(null);
    this.reps.set([]);
    this.livePoints.set([]);
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

  end(): void {
    const s = this.state();
    if (s === 'countdown') { this.cleanup(); this.state.set('idle'); return; }
    if (s !== 'recording' || !this.exercise) return;

    const durationMs = Math.round(performance.now() - this.t0);
    this.cleanup();
    this.result.set({
      id: uid(),
      exerciseId: this.exercise.id,
      mode: this.mode(),
      startedAt: this.startedAt,
      durationMs,
      reps: this.reps(),
      trace: this.trace,
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
    this.state.set('idle');
  }

  // ---------- internals ----------

  private begin(): void {
    this.tracker.start(this.exercise!); // fresh counter
    this.t0 = performance.now();
    this.startedAt = Date.now();
    this.lastRepAt = this.t0;
    this.lastSampleT = -Infinity;
    this.trace = [];
    this.state.set('recording');
    this.subs.push(
      this.tracker.sample$.subscribe(s => this.onSample(s.t, s.angle)),
      this.tracker.rep$.subscribe(e => this.onRep(e)),
    );
    this.timer = setInterval(() => this.tick(), 250);
  }

  private onSample(ts: number, angle: number): void {
    const t = ts - this.t0;
    if (t < 0 || t - this.lastSampleT < SAMPLE_MS) return;
    this.lastSampleT = t;
    const p: TracePoint = { t: Math.round(t), a: Math.round(angle * 10) / 10 };
    this.trace.push(p);
    this.livePoints.update(prev => {
      const cutoff = t - LIVE_WINDOW_MS;
      let i = 0;
      while (i < prev.length && prev[i].t < cutoff) i++;
      return [...prev.slice(i), p];
    });
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
    if (e.counted) this.lastRepAt = e.endedAt;
  }

  private tick(): void {
    const now = performance.now();
    this.elapsedSec.set(Math.floor((now - this.t0) / 1000));
    if (now - this.t0 > MAX_SET_MS) { this.end(); return; }
    const hasRep = this.reps().some(r => r.counted);
    if (this.mode() === 'max' && hasRep && now - this.lastRepAt > IDLE_END_MS) this.end();
  }

  private cleanup(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }
}