export type Phase = 'top' | 'descending' | 'bottom' | 'ascending';

export interface Thresholds {
  topEnter: number;
  topExit: number;
  bottomEnter: number;
  bottomExit: number;
}

export interface RepEvent {
  counted: boolean;
  gateMissed: boolean; // reached depth, but the extra check (e.g. chin over bar) failed
  index: number;
  minAngle: number;
  downMs: number;
  upMs: number;
  totalMs: number;
  endedAt: number;
}

export class RepCounter {
  phase: Phase = 'top';
  reps = 0;
  private minAngle = 180;
  private startTs = 0;
  private bottomTs = 0;
  private ascendTs = 0;
  private gateMet = false;

  constructor(private readonly th: Thresholds) {}

  reset(): void { this.reps = 0; this.abort(); }

  abort(): void {
    this.phase = 'top';
    this.minAngle = 180;
    this.startTs = this.bottomTs = this.ascendTs = 0;
    this.gateMet = false;
  }

  /** gate: optional extra condition; must be true at some point during the rep. */
  update(angle: number, t: number, gate = true): RepEvent | null {
    const th = this.th;
    if (gate && this.phase !== 'top') this.gateMet = true;

    switch (this.phase) {
      case 'top':
        if (angle < th.topExit) {
          this.phase = 'descending';
          this.startTs = t;
          this.minAngle = angle;
          this.bottomTs = this.ascendTs = 0;
          this.gateMet = false;
        }
        break;

      case 'descending':
        this.minAngle = Math.min(this.minAngle, angle);
        if (angle <= th.bottomEnter) {
          this.phase = 'bottom';
          this.bottomTs = t;
        } else if (angle >= th.topEnter) {
          this.phase = 'top';
          return this.finish(false, t);
        }
        break;

      case 'bottom':
        this.minAngle = Math.min(this.minAngle, angle);
        if (angle > th.bottomExit) {
          this.phase = 'ascending';
          this.ascendTs = t;
        }
        break;

      case 'ascending':
        this.minAngle = Math.min(this.minAngle, angle);
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

  private finish(reachedDepth: boolean, t: number): RepEvent {
    const counted = reachedDepth && this.gateMet;
    if (counted) this.reps++;
    return {
      counted,
      gateMissed: reachedDepth && !this.gateMet,
      index: this.reps,
      minAngle: this.minAngle,
      downMs: reachedDepth ? this.bottomTs - this.startTs : 0,
      upMs: reachedDepth ? t - this.ascendTs : 0,
      totalMs: t - this.startTs,
      endedAt: t,
    };
  }
}
