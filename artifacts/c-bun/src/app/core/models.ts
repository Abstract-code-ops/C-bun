export type SetMode = 'free' | 'max';

export interface RepRecord {
  index: number;       // counted rep number; 0 for partial reps
  counted: boolean;
  gateMissed: boolean;
  minAngle: number;
  downMs: number;      // "closing" phase: angle shrinking
  upMs: number;        // "opening" phase: angle growing
  totalMs: number;
  endMs: number;       // ms since set start
}

export interface TracePoint { t: number; a: number } // ms since set start, angle in degrees

export interface SetRecord {
  id: string;
  exerciseId: string;
  mode: SetMode;
  startedAt: number;   // epoch ms
  durationMs: number;
  reps: RepRecord[];
  trace: TracePoint[];
}

export interface UserMax { exerciseId: string; reps: number; setId: string; date: number }

export const countedReps = (s: SetRecord): number => s.reps.filter(r => r.counted).length;
