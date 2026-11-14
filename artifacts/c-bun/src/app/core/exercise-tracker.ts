import { Service, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { Pose, PoseFrame } from './pose';
import { ExerciseConfig, Side } from './exercises';
import { RepCounter, RepEvent, Phase } from '../utils/rep-counter';
import { angleDeg } from '../utils/angles';
import { Ema } from '../utils/smoothing';

const MIN_VISIBILITY = 0.5;
const GAP_RESET_MS = 500;   // reset smoothing after a gap
const GAP_ABORT_MS = 2000;  // abandon a rep if tracking is lost this long

export interface AngleSample { t: number; angle: number }

@Service()
export class ExerciseTracker {
  private readonly pose = inject(Pose);
  private sub: Subscription | null = null;
  private counter: RepCounter | null = null;
  private config: ExerciseConfig | null = null;
  private side: Side = 'left';
  private readonly ema = new Ema(40);
  private lastT = 0;

  readonly reps = signal(0);
  readonly phase = signal<Phase>('top');
  readonly phaseLabel = signal<string>('top');
  readonly trace = signal<string[]>([]);
  readonly angle = signal<number | null>(null); // debug: use it to tune thresholds
  readonly feedback = signal<string | null>(null);

  /** Phase 3 (form scoring, storage) subscribes here. */
  private readonly _rep$ = new Subject<RepEvent>();
  readonly rep$ = this._rep$.asObservable();
  private readonly _sample$ = new Subject<AngleSample>();
  readonly sample$ = this._sample$.asObservable();


  private setPhase(p: Phase, cfg: ExerciseConfig): void {
    this.phase.set(p);
    this.phaseLabel.set(cfg.phaseLabels?.[p] ?? p);
  }

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
    this.feedback.set(null);
    this.lastT = 0;
    this.trace.set([]);
    this.phaseLabel.set(this.config?.phaseLabels?.top ?? 'top');
  }

  private onFrame(frame: PoseFrame | null): void {
    const cfg = this.config, counter = this.counter;
    if (!cfg || !counter) return;

    if (!frame || frame.world.length === 0) return this.lose();

    // Only switch sides while standing, so the angle never jumps mid-rep
    if (counter.phase === 'top') this.side = this.pickSide(frame, cfg);
    const [i, j, k] = cfg.joints[this.side];
    const lm = frame.landmarks;
    const vis = Math.min(lm[i]?.visibility ?? 0, lm[j]?.visibility ?? 0, lm[k]?.visibility ?? 0);
    if (vis < MIN_VISIBILITY) return this.lose();

    const raw = angleDeg(frame.world[i], frame.world[j], frame.world[k]);
    if (!Number.isFinite(raw)) return;

    const gap = frame.timestamp - this.lastT;
    if (this.lastT && gap > GAP_ABORT_MS) counter.abort();
    if (this.lastT && gap > GAP_RESET_MS) this.ema.reset();
    this.lastT = frame.timestamp;

    const smooth = this.ema.next(raw, frame.timestamp);
    this._sample$.next({ t: frame.timestamp, angle: smooth });
    this.angle.set(Math.round(smooth));

    const gate = cfg.gate ? cfg.gate(frame, this.side) : true;
    const before = counter.phase;
    const ev = counter.update(smooth, frame.timestamp, gate);
    this.setPhase(counter.phase, cfg);
    if (counter.phase !== before) {
      this.trace.update(t => [...t.slice(-5), `${before}→${counter.phase} ${Math.round(smooth)}°`]);
      if (before === 'top') this.feedback.set(null);
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

  private lose(): void {
    this.ema.reset();
    this.angle.set(null);
  }

  private pickSide(frame: PoseFrame, cfg: ExerciseConfig): Side {
    const score = (side: Side) =>
      cfg.joints[side].reduce((s, idx) => s + (frame.landmarks[idx]?.visibility ?? 0), 0);
    return score('right') > score('left') + 0.2 ? 'right'
         : score('left') > score('right') + 0.2 ? 'left'
         : this.side;
  }
}
