/** Structural subset of your RepRecord, so this file has no other dependencies. */
export interface QRep {
  counted: boolean;
  failed?: boolean;
  minAngle: number;   // raw minimum angle for the rep
  downMs: number;
  upMs: number;
  totalMs: number;
}

export interface SetQuality {
  score: number;        // 0-100
  rom: number;
  control: number;
  consistency: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** 100 when the target depth is reached; loses 2.5 points per degree short (40 deg short = 0). */
export function romScore(minAngle: number, target: number): number {
  const shortBy = minAngle - target;
  return shortBy <= 0 ? 100 : clamp(100 - shortBy * 2.5, 0, 100);
}

/** Penalises bouncing/dropping: fastest phase 200 ms = 0, 500 ms or slower = 100. */
export function speedScore(downMs: number, upMs: number): number {
  return clamp(((Math.min(downMs, upMs) - 200) / 300) * 100, 0, 100);
}

/** `target` = th.depthTarget ?? th.bottomEnter of the exercise. Failed reps are ignored. */
export function setQuality(reps: QRep[], target: number): SetQuality {
  const valid = reps.filter(r => !r.failed);
  if (!valid.length) return { score: 0, rom: 0, control: 0, consistency: 0 };

  const rom = mean(valid.map(r => romScore(r.minAngle, target)));
  const control = mean(valid.map(r => speedScore(r.downMs, r.upMs)));

  const totals = valid.map(r => r.totalMs);
  let consistency = 100;
  if (totals.length >= 3) {
    const m = mean(totals);
    const sd = Math.sqrt(mean(totals.map(t => (t - m) ** 2)));
    consistency = clamp(100 - (m > 0 ? sd / m : 0) * 150, 0, 100);
  }

  const repAvg = mean(valid.map(r => 0.5 * romScore(r.minAngle, target) + 0.5 * speedScore(r.downMs, r.upMs)));
  const score = clamp(0.85 * repAvg + 0.15 * consistency, 0, 100);
  return { score: Math.round(score), rom: Math.round(rom), control: Math.round(control), consistency: Math.round(consistency) };
}