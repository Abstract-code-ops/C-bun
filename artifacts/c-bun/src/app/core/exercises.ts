import { Thresholds } from '../utils/rep-counter';
import type { Phase } from '../utils/rep-counter';
import type { PoseFrame } from './pose';

export type Side = 'left' | 'right';

export interface ExerciseConfig {
  id: string;
  label: string;
  /** Landmark indices [a, b, c]; the angle is measured at b. */
  joints: Record<Side, [number, number, number]>;
  thresholds: Thresholds;
  shallowHint: string;
  gateHint?: string;
  gate?: (frame: PoseFrame, side: Side) => boolean;
  phaseLabels?: Partial<Record<Phase, string>>;
}

// MediaPipe indices: 11/12 shoulders, 13/14 elbows, 15/16 wrists,
// 23/24 hips, 25/26 knees, 27/28 ankles (left/right)
export const SQUAT: ExerciseConfig = {
  id: 'squat',
  label: 'Squat',
  joints: { left: [23, 25, 27], right: [24, 26, 28] },
  thresholds: { topEnter: 165, topExit: 155, bottomEnter: 50, bottomExit: 70 },
  shallowHint: 'Go deeper',
};

// Untested, included for Phase 3
export const PUSHUP: ExerciseConfig = {
  id: 'pushup',
  label: 'Push-up',
  joints: { left: [11, 13, 15], right: [12, 14, 16] },
  thresholds: { topEnter: 140, topExit: 130, bottomEnter: 105, bottomExit: 115 },
  shallowHint: 'Lower your chest',
};

const MIN_VIS = 0.5;
const CHIN_MARGIN = 0.02; // fraction of image height. Raise = stricter, lower = more lenient

/** Proxy for "chin over bar": mouth is above the wrists (hands are on the bar). */
function chinOverBar(frame: PoseFrame): boolean {
  const lm = frame.landmarks;
  const mouth = [lm[9], lm[10]].filter(p => (p?.visibility ?? 0) >= MIN_VIS);
  const wrists = [lm[15], lm[16]].filter(p => (p?.visibility ?? 0) >= MIN_VIS);
  if (!mouth.length || !wrists.length) return false;
  const chinY = mouth.reduce((s, p) => s + p.y, 0) / mouth.length;
  const barY = wrists.reduce((s, p) => s + p.y, 0) / wrists.length;
  return chinY < barY - CHIN_MARGIN; // y grows downward
}

// Untested. "top" = hanging, "bottom" = pulled up
export const PULLUP: ExerciseConfig = {
  id: 'pullup',
  label: 'Pull-up',
  joints: { left: [11, 13, 15], right: [12, 14, 16] },
  thresholds: { topEnter: 150, topExit: 140, bottomEnter: 80, bottomExit: 95 },
  shallowHint: 'Pull higher',
  gateHint: 'Chin over the bar',
  gate: chinOverBar,
  phaseLabels: { top: 'hang', descending: 'pulling', bottom: 'chin up', ascending: 'lowering' },
};

export const EXERCISES: ExerciseConfig[] = [SQUAT, PUSHUP, PULLUP];