import { PlanExerciseId, PlannedExercise } from '../core/plan-models';

export const EX_LABEL: Record<PlanExerciseId, string> = {
  pullup: 'Pull-ups',
  pushup: 'Push-ups',
  squat: 'Squats',
};

export const EX_ICON: Record<PlanExerciseId, string> = {
  pullup: 'vertical_align_top',
  pushup: 'accessibility_new',
  squat: 'airline_seat_legroom_normal',
};

/** Local calendar date as 'YYYY-MM-DD' (toISOString would use UTC and shift the day). */
export function localIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(iso: string): string {
  return parseIso(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function summarize(ex: PlannedExercise): string {
  const t = ex.sets.map(s => s.targetReps);
  return t.every(x => x === t[0]) ? `${t.length} × ${t[0]}` : t.join(' · ');
}