export type Phase = 'top' | 'descending' | 'bottom' | 'ascending';

export interface Thresholds {
  topEnter: number;    // angle >= this: back at the top
  topExit: number;     // angle <  this: rep started
  bottomEnter: number; // angle <= this: reached depth
  bottomExit: number;  // angle >  this: left the bottom
}

export interface RepEvent {
  counted: boolean;    // false = partial rep (never reached depth)
  index: number;       // rep number (counted reps only)
  minAngle: number;    // deepest angle reached
  downMs: number;      // top -> bottom
  upMs: number;        // bottom -> top
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

  constructor(private readonly th: Thresholds) {}

  reset(): void { this.reps = 0; this.abort(); }

  /** Drop the rep in progress without counting it (e.g. tracking lost). */
  abort(): void {
    this.phase = 'top';
    this.minAngle = 180;
    this.startTs = this.bottomTs = this.ascendTs = 0;
  }

  update(angle: number, t: number): RepEvent | null {
    const th = this.th;
    switch (this.phase) {
      case 'top':
        if (angle < th.topExit) {
          this.phase = 'descending';
          this.startTs = t;
          this.minAngle = angle;
          this.bottomTs = this.ascendTs = 0;
        }
        break;

      case 'descending':
        this.minAngle = Math.min(this.minAngle, angle);
        if (angle <= th.bottomEnter) {
          this.phase = 'bottom';
          this.bottomTs = t;
        } else if (angle >= th.topEnter) {
          this.phase = 'top';
          return this.finish(false, t); // came back up without reaching depth
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
          this.phase = 'bottom'; // dipped again before standing
        } else if (angle >= th.topEnter) {
          this.phase = 'top';
          return this.finish(true, t);
        }
        break;
    }
    return null;
  }

  private finish(counted: boolean, t: number): RepEvent {
    if (counted) this.reps++;
    return {
      counted,
      index: this.reps,
      minAngle: this.minAngle,
      downMs: counted ? this.bottomTs - this.startTs : 0,
      upMs: counted ? t - this.ascendTs : 0,
      totalMs: t - this.startTs,
      endedAt: t,
    };
  }
}
