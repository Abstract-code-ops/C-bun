import { Service, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { Pose, PoseFrame } from './pose';
import { ExerciseConfig, Side } from './exercises';
import { RepCounter, RepEvent, Phase } from '../utils/rep-counter';
import { angleDeg } from '../utils/angles';
import { Ema } from '../utils/smoothing';

export interface AngleSample { t: number; angle: number; phase: Phase }

const MIN_VISIBILITY = 0.5;
const GAP_RESET_MS = 500;
const GAP_ABORT_MS = 2000;

@Service()
export class ExerciseTracker {
  private readonly pose = inject(Pose);
  private sub: Subscription | null = null;
  private counter: RepCounter | null = null;
  private config: ExerciseConfig | null = null;
  private side: Side = 'left';           // the better-seen arm/leg (used by the gate)
  private readonly ema = new Ema(40);    // time constant in ms
  private lastT = 0;

  readonly reps = signal(0);
  readonly phase = signal<Phase>('top');
  readonly phaseLabel = signal<string>('top');
  readonly angle = signal<number | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly trace = signal<string[]>([]);

  private readonly _rep$ = new Subject<RepEvent>();
  readonly rep$ = this._rep$.asObservable();
  private readonly _sample$ = new Subject<AngleSample>();
  readonly sample$ = this._sample$.asObservable();

  start(config: ExerciseConfig): void {
    this.stop();
    this.config = config;
    this.counter = new RepCounter(config.thresholds);
    this.reset();
    this.sub = this.pose.frame$.subscribe(f => this.onFrame(f));
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    this.angle.set(null);
  }

  reset(): void {
    this.counter?.reset();
    this.ema.reset();
    this.reps.set(0);
    this.phase.set('top');
    this.phaseLabel.set(this.config?.phaseLabels?.top ?? 'top');
    this.feedback.set(null);
    this.trace.set([]);
    this.lastT = 0;
  }

  private onFrame(frame: PoseFrame | null): void {
    const cfg = this.config, counter = this.counter;
    if (!cfg || !counter) return;
    if (!frame || frame.world.length === 0) return this.lose();

    // Fuse both sides: weight each arm/leg by how well it is seen. No side switching.
    const lm = frame.landmarks;
    let num = 0, den = 0, bestW = 0;
    for (const s of ['left', 'right'] as const) {
      const [i, j, k] = cfg.joints[s];
      const v = Math.min(lm[i]?.visibility ?? 0, lm[j]?.visibility ?? 0, lm[k]?.visibility ?? 0);
      if (v < MIN_VISIBILITY) continue;
      const a = angleDeg(frame.world[i], frame.world[j], frame.world[k]);
      if (!Number.isFinite(a)) continue;
      const w = v * v;
      num += a * w;
      den += w;
      if (w > bestW) { bestW = w; this.side = s; }
    }
    if (den === 0) return this.lose();
    const raw = num / den;

    const gap = frame.timestamp - this.lastT;
    if (this.lastT && gap > GAP_ABORT_MS) counter.abort();
    if (this.lastT && gap > GAP_RESET_MS) this.ema.reset();
    this.lastT = frame.timestamp;

    const smooth = this.ema.next(raw, frame.timestamp);
    this.angle.set(Math.round(smooth));

    const gate = cfg.gate ? cfg.gate(frame, this.side) : true;
    const before = counter.phase;
    const ev = counter.update(smooth, frame.timestamp, gate, raw);
    this.setPhase(counter.phase, cfg);
    this._sample$.next({ t: frame.timestamp, angle: smooth, phase: counter.phase });

    if (counter.phase !== before) {
      this.trace.update(t => [...t.slice(-5), `${before}→${counter.phase} ${Math.round(smooth)}°`]);
      if (before === 'top') this.feedback.set(null); // a new rep started: clear the old hint
    }
    if (ev) {
      this._rep$.next(ev);
      if (ev.counted) {
        this.reps.set(counter.reps);
        this.feedback.set(null);
      } else {
        this.feedback.set(ev.gateMissed ? (cfg.gateHint ?? cfg.shallowHint) : cfg.shallowHint);
      }
    }
  }

  private setPhase(p: Phase, cfg: ExerciseConfig): void {
    this.phase.set(p);
    this.phaseLabel.set(cfg.phaseLabels?.[p] ?? p);
  }

  private lose(): void {
    this.ema.reset();
    this.angle.set(null);
  }
}