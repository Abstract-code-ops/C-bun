export type Phase = 'top' | 'descending' | 'bottom' | 'ascending';

export interface Thresholds {
  topEnter: number;
  topExit: number;
  bottomEnter: number;   // loose trigger for the bottom state (uses the smoothed angle)
  bottomExit: number;
  /** Optional: the raw (unsmoothed) angle must reach at least this low for a rep to count. */
  depthTarget?: number;
}

export interface RepEvent {
  counted: boolean;
  gateMissed: boolean;   // deep enough, but the extra check (chin over bar) failed
  tooShallow: boolean;   // reached the bottom zone, but not the depth target
  index: number;
  minAngle: number;      // raw minimum during the rep
  downMs: number;
  upMs: number;
  totalMs: number;
  endedAt: number;
}

export class RepCounter {
  phase: Phase = 'top';
  reps = 0;
  private rawMin = 180;
  private startTs = 0;
  private bottomTs = 0;
  private ascendTs = 0;
  private gateMet = false;

  constructor(private readonly th: Thresholds) {}

  reset(): void { this.reps = 0; this.abort(); }

  abort(): void {
    this.phase = 'top';
    this.rawMin = 180;
    this.startTs = this.bottomTs = this.ascendTs = 0;
    this.gateMet = false;
  }

  /** angle: smoothed (drives the state machine). raw: unsmoothed (judges depth). */
  update(angle: number, t: number, gate = true, raw = angle): RepEvent | null {
    const th = this.th;
    if (this.phase !== 'top') {
      this.rawMin = Math.min(this.rawMin, raw);
      if (gate) this.gateMet = true;
    }

    switch (this.phase) {
      case 'top':
        if (angle < th.topExit) {
          this.phase = 'descending';
          this.startTs = t;
          this.rawMin = raw;
          this.bottomTs = this.ascendTs = 0;
          this.gateMet = false;
        }
        break;

      case 'descending':
        if (angle <= th.bottomEnter) {
          this.phase = 'bottom';
          this.bottomTs = t;
        } else if (angle >= th.topEnter) {
          this.phase = 'top';
          return this.finish(false, t);
        }
        break;

      case 'bottom':
        if (angle > th.bottomExit) {
          this.phase = 'ascending';
          this.ascendTs = t;
        }
        break;

      case 'ascending':
        if (angle <= th.bottomEnter) {
          this.phase = 'bottom';
        } else if (angle >= th.topEnter) {
          this.phase = 'top';
          return this.finish(true, t);
        }
        break;
    }
    return null;
  }

  private finish(reachedBottom: boolean, t: number): RepEvent {
    const deep = this.th.depthTarget === undefined || this.rawMin <= this.th.depthTarget;
    const counted = reachedBottom && deep && this.gateMet;
    if (counted) this.reps++;
    return {
      counted,
      gateMissed: reachedBottom && deep && !this.gateMet,
      tooShallow: reachedBottom && !deep,
      index: this.reps,
      minAngle: this.rawMin,
      downMs: reachedBottom ? this.bottomTs - this.startTs : 0,
      upMs: reachedBottom ? t - this.ascendTs : 0,
      totalMs: t - this.startTs,
      endedAt: t,
    };
  }
}
