import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { EXERCISES } from './exercises';
import { SetRecord, countedReps } from './models';
import { Nav } from './nav';
import { PlanExerciseId } from './plan-models';
import { PlanStore } from './plan-store';
import { SetRecorder } from './set-recorder';
import { setQuality } from '../utils/quality';

@Service()
export class PlanSession {
  private readonly ps = inject(PlanStore);
  private readonly nav = inject(Nav);
  private readonly rec = inject(SetRecorder);

  /** True while a planned workout is running (set by Start workout, cleared by End). */
  readonly active = signal(false);
  /** LiveView selects this exercise whenever it changes (n makes repeats distinct). */
  readonly requested = signal<{ ex: PlanExerciseId; n: number } | null>(null);
  readonly next = this.ps.next;

  readonly restTotal = signal(0);
  readonly restLeft = signal(0);
  readonly resting = computed(() => this.restLeft() > 0);
  readonly lastResult = signal<{ doneReps: number; targetReps: number } | null>(null);

  private restEnd = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private nonce = 0;
  private wake: WakeLockSentinel | null = null;

  constructor() {
    // starting a set (even during rest) cancels the rest timer
    effect(() => {
      if (this.rec.state() !== 'idle') untracked(() => this.cancelRest());
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.active()) void this.lock();
    });
  }

  begin() {
    if (!this.ps.next()) return;
    this.active.set(true);
    this.lastResult.set(null);
    this.nav.go('train');
    this.request();
    void this.lock();
  }

  end() {
    this.active.set(false);
    this.cancelRest();
    this.requested.set(null);
    this.unlock();
  }

  skipSet() {
    const t = this.ps.next();
    if (!t) return;
    this.ps.skipSet(t);
    this.cancelRest();
    this.request();
  }

  skipRest() {
    this.cancelRest();
    this.request();
  }

  /** Called after a set is saved. Returns true when it was credited to the plan. */
  /** Called after a set is saved. Returns true when it was credited to the plan. */
  onSaved(set: SetRecord, exerciseId: string): boolean {
    const t = this.ps.next();
    if (!this.active() || !t || exerciseId !== t.exercise) return false;

    const cfg = EXERCISES.find(e => e.id === exerciseId);
    const target = cfg ? (cfg.thresholds.depthTarget ?? cfg.thresholds.bottomEnter) : 0;
    const quality = cfg ? setQuality(set.reps, target).score : 0;
    const doneReps = countedReps(set);

    this.ps.completeSet(t, { doneReps, quality });
    this.lastResult.set({ doneReps, targetReps: t.targetReps });

    if (this.ps.next()) this.startRest(t.restSec);
    else this.cancelRest();
    return true;
  }

  // ---- rest timer ----------------------------------------------------------

  private startRest(sec: number) {
    this.cancelRest();
    this.restTotal.set(sec);
    this.restEnd = Date.now() + sec * 1000;
    this.restLeft.set(sec);
    this.tick = setInterval(() => {
      const left = Math.ceil((this.restEnd - Date.now()) / 1000);
      if (left <= 0) this.finishRest();
      else this.restLeft.set(left);
    }, 250);
  }

  private finishRest() {
    this.cancelRest();
    this.cue();
    this.request();
  }

  private cancelRest() {
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
    this.restLeft.set(0);
  }

  private request() {
    const n = this.ps.next();
    if (n) this.requested.set({ ex: n.exercise, n: ++this.nonce });
  }

  private cue() {
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* unsupported */ }
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
      o.onended = () => void ctx.close();
    } catch { /* blocked */ }
  }

  // ---- keep the screen on ----------------------------------------------------

  private async lock() {
    try {
      if (this.wake && !this.wake.released) return;
      this.wake = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch { /* unsupported or denied */ }
  }

  private unlock() {
    this.wake?.release().catch(() => {});
    this.wake = null;
  }
}