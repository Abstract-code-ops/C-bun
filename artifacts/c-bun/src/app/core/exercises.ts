import { Thresholds } from '../utils/rep-counter';

export type Side = 'left' | 'right';

export interface ExerciseConfig {
  id: string;
  label: string;
  /** Landmark indices [a, b, c]; the angle is measured at b. */
  joints: Record<Side, [number, number, number]>;
  thresholds: Thresholds;
  shallowHint: string;
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
  thresholds: { topEnter: 113, topExit: 140, bottomEnter: 98, bottomExit: 105 },
  shallowHint: 'Lower your chest',
};

export const EXERCISES: ExerciseConfig[] = [SQUAT, PUSHUP];