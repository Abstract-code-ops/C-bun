import type { Phase } from '../utils/rep-counter';

export type SetMode = 'free' | 'max';
export type SegmentKind = 'rest' | 'lost' | 'stall';
export type EndReason = 'manual' | 'failure' | 'rest' | 'lost' | 'timeout';

export const PHASE_ORDER: Phase[] = ['top', 'descending', 'bottom', 'ascending'];

export interface RepRecord {
  index: number;       // counted rep number; 0 for partial or failed
  counted: boolean;
  gateMissed: boolean;
  failed?: boolean;    // the attempt that ended a max test by mechanical failure
  minAngle: number;
  downMs: number;
  upMs: number;
  totalMs: number;
  endMs: number;
}

export interface TracePoint { t: number; a: number; p?: number } // p = index into PHASE_ORDER

export interface Segment { kind: SegmentKind; startMs: number; endMs: number }

export interface SetRecord {
  id: string;
  exerciseId: string;
  mode: SetMode;
  startedAt: number;
  durationMs: number;
  reps: RepRecord[];
  trace: TracePoint[];
  segments?: Segment[];   // optional so older saved sets still load
  endReason?: EndReason;
}

export interface UserMax { exerciseId: string; reps: number; setId: string; date: number }

export const countedReps = (s: SetRecord): number => s.reps.filter(r => r.counted).length;