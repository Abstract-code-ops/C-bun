export type PlanExerciseId = 'pullup' | 'pushup' | 'squat';
export const PLAN_EXERCISES: readonly PlanExerciseId[] = ['pullup', 'pushup', 'squat'];

export type WeekNumber = 1 | 2 | 3 | 4;
export type WeekLabel = 'Build' | 'Push' | 'Deload';
export type SetStatus = 'pending' | 'done' | 'skipped';

export interface PlanConfig {
  startDate: string;                       // 'YYYY-MM-DD'
  daysPerWeek: 3;
  maxes: Record<PlanExerciseId, number>;   // snapshot of max reps at plan creation
}

export interface PlannedSet {
  targetReps: number;
  status: SetStatus;
  doneReps?: number;
  recordId?: string;                       // SetRecord id from the recorder
  quality?: number;                        // 0-100, internal only (never shown)
}

export interface PlannedExercise {
  exercise: PlanExerciseId;
  restSec: number;
  note?: string;
  sets: PlannedSet[];
}

export interface PlannedDay {
  date: string;
  label: string;
  exercises: PlannedExercise[];
}

export interface Adjustment {
  exercise: PlanExerciseId;
  setsDelta: number;                       // clamped to -1..1
  repsDelta: number;                       // clamped to -2..2
  reason: string;
}

export interface PlannedWeek {
  weekNumber: WeekNumber;
  label: WeekLabel;
  startDate: string;
  intensityPct: number;
  bonusPct: number;
  days: PlannedDay[];
  coachApplied?: boolean;
  adjustments?: Adjustment[];
}

export interface Plan {
  id: string;
  createdAt: string;
  config: PlanConfig;
  weeks: PlannedWeek[];                    // week instances in order; a held week appears twice
  status: 'active' | 'retest';
}

export interface WeekEvaluation {
  decision: 'advance' | 'hold' | 'retest';
  completion: number;                      // 0..1 share of sets that hit target
  avgQuality: number;                      // 0..100
  sessionsDone: number;
  holds: number;                           // earlier repeats of this same week
  nextBonusPct: number;
  reason: string;
}

export type TodayState =
  | { kind: 'upcoming'; startsOn: string }
  | { kind: 'workout'; week: PlannedWeek; day: PlannedDay; done: boolean }
  | { kind: 'rest'; week: PlannedWeek; next?: PlannedDay }
  | { kind: 'week-over' }                  // today is past the last planned week: evaluate and advance
  | { kind: 'retest' };