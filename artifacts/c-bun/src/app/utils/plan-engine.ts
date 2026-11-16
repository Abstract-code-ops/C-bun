import {
  Adjustment, Plan, PlanConfig, PlannedDay, PlannedWeek,
  PLAN_EXERCISES, TodayState, WeekEvaluation, WeekLabel, WeekNumber,
} from '../core/plan-models';

interface WeekTemplate { label: WeekLabel; sets: number; pct: number; restSec: number; deload: boolean }

export const WEEK_TEMPLATES: Record<WeekNumber, WeekTemplate> = {
  1: { label: 'Build',  sets: 4, pct: 0.60,  restSec: 90,  deload: false },
  2: { label: 'Build',  sets: 4, pct: 0.65,  restSec: 90,  deload: false },
  3: { label: 'Push',   sets: 5, pct: 0.70,  restSec: 120, deload: false },
  4: { label: 'Deload', sets: 3, pct: 0.50,  restSec: 60,  deload: true  },
};

export const DAY_OFFSETS = [0, 2, 4] as const;   // 3 sessions, rest day between each
const MAX_PCT = 0.8;
const BONUS_STEP = 0.025;
const BONUS_CAP = 0.1;

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const clampInt = (x: number, lo: number, hi: number) => clamp(Math.round(x), lo, hi);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function intensityFor(tpl: WeekTemplate, bonusPct: number): number {
  return tpl.deload ? tpl.pct : r3(Math.min(MAX_PCT, tpl.pct + bonusPct));
}

/** Reps and sets for one exercise in one week. */
export function prescribe(max: number, tpl: WeekTemplate, bonusPct: number): { reps: number; sets: number; note?: string } {
  const m = Math.max(0, Math.floor(max));
  if (m === 0) {
    return { reps: 1, sets: 3, note: 'Max is 0: do 1 slow, assisted rep per set (band, jump, or slow lowering).' };
  }
  const pct = intensityFor(tpl, bonusPct);
  const reps = Math.max(1, Math.round(+(m * pct).toFixed(6)));

  let sets = tpl.sets;
  if (!tpl.deload && m <= 3) sets += 2;
  else if (!tpl.deload && m <= 5) sets += 1;

  if (m <= 3) {                                   // keep total volume sane for very low maxes
    const cap = Math.max(3, Math.floor(m * 3.5));
    sets = Math.max(3, Math.min(sets, Math.floor(cap / reps)));
  }
  return { reps, sets };
}

export function buildWeek(config: PlanConfig, weekNumber: WeekNumber, startDate: string, bonusPct = 0): PlannedWeek {
  const tpl = WEEK_TEMPLATES[weekNumber];
  const bonus = tpl.deload ? 0 : bonusPct;
  const days: PlannedDay[] = DAY_OFFSETS.map((off, i) => ({
    date: addDays(startDate, off),
    label: `Session ${i + 1}`,
    exercises: PLAN_EXERCISES.map(exercise => {
      const p = prescribe(config.maxes[exercise] ?? 0, tpl, bonus);
      return {
        exercise,
        restSec: tpl.restSec,
        ...(p.note ? { note: p.note } : {}),
        sets: Array.from({ length: p.sets }, () => ({ targetReps: p.reps, status: 'pending' as const })),
      };
    }),
  }));
  return { weekNumber, label: tpl.label, startDate, intensityPct: intensityFor(tpl, bonus), bonusPct: bonus, days };
}

export function createPlan(config: PlanConfig, id: string, nowIso: string): Plan {
  return { id, createdAt: nowIso, config, weeks: [buildWeek(config, 1, config.startDate)], status: 'active' };
}

export function currentWeek(plan: Plan): PlannedWeek {
  return plan.weeks[plan.weeks.length - 1];
}

/** Evaluates the latest week. The rules decide, never the AI. */
export function evaluateWeek(plan: Plan): WeekEvaluation {
  const week = currentWeek(plan);
  const sets = week.days.flatMap(d => d.exercises.flatMap(e => e.sets));
  const hit = sets.filter(s => s.status === 'done' && (s.doneReps ?? 0) >= s.targetReps).length;
  const completion = sets.length ? hit / sets.length : 0;
  const avgQuality = mean(sets.filter(s => s.status === 'done' && s.quality !== undefined).map(s => s.quality as number));
  const sessionsDone = week.days.filter(d => d.exercises.some(e => e.sets.some(s => s.status === 'done'))).length;

  let holds = 0;
  for (let i = plan.weeks.length - 2; i >= 0 && plan.weeks[i].weekNumber === week.weekNumber; i--) holds++;

  let bonus = week.bonusPct;
  if (completion === 1 && avgQuality >= 90) bonus = r3(Math.min(BONUS_CAP, bonus + BONUS_STEP));
  else if (completion < 0.7) bonus = r3(Math.max(0, bonus - BONUS_STEP));

  const base = { completion, avgQuality: Math.round(avgQuality), sessionsDone, holds, nextBonusPct: bonus };

  if (week.weekNumber === 4) return { ...base, decision: 'retest', reason: 'Deload done: time to re-test your max.' };
  if (sessionsDone >= 2 && completion >= 0.9 && avgQuality >= 80) {
    return { ...base, decision: 'advance', reason: 'Targets hit with good form.' };
  }
  if (holds >= 2) return { ...base, decision: 'advance', reason: 'Repeated twice: moving on at the same load.' };
  return { ...base, decision: 'hold', reason: 'Repeat this week to lock it in.' };
}

/** Applies the evaluation: next week, repeat week, or flag the re-test. */
export function advancePlan(plan: Plan, ev: WeekEvaluation): Plan {
  if (ev.decision === 'retest') return { ...plan, status: 'retest' };
  const last = currentWeek(plan);
  const nextNumber = (ev.decision === 'advance' ? last.weekNumber + 1 : last.weekNumber) as WeekNumber;
  const week = buildWeek(plan.config, nextNumber, addDays(last.startDate, 7), ev.nextBonusPct);
  return { ...plan, weeks: [...plan.weeks, week] };
}

export function todaysWorkout(plan: Plan, today: string): TodayState {
  const first = plan.weeks[0];
  if (today < first.startDate) return { kind: 'upcoming', startsOn: first.startDate };
  if (plan.status === 'retest') return { kind: 'retest' };

  const week = plan.weeks.find(w => today >= w.startDate && today < addDays(w.startDate, 7));
  if (!week) return { kind: 'week-over' };

  const day = week.days.find(d => d.date === today);
  if (!day) return { kind: 'rest', week, next: week.days.find(d => d.date > today) };
  const done = day.exercises.every(e => e.sets.every(s => s.status !== 'pending'));
  return { kind: 'workout', week, day, done };
}

export function clampAdjustment(a: Adjustment): Adjustment | null {
  if (!a || !PLAN_EXERCISES.includes(a.exercise)) return null;
  if (!Number.isFinite(a.setsDelta) || !Number.isFinite(a.repsDelta)) return null;
  return {
    exercise: a.exercise,
    setsDelta: clampInt(a.setsDelta, -1, 1),
    repsDelta: clampInt(a.repsDelta, -2, 2),
    reason: String(a.reason ?? '').slice(0, 160),
  };
}

/** Applies coach suggestions, clamped. Pending sets only, once per week. */
export function applyAdjustments(config: PlanConfig, week: PlannedWeek, raw: Adjustment[]): PlannedWeek {
  if (week.coachApplied) return week;
  const adj = raw.map(clampAdjustment).filter((a): a is Adjustment => a !== null);
  if (!adj.length) return week;

  const days = week.days.map(day => ({
    ...day,
    exercises: day.exercises.map(ex => {
      const mine = adj.filter(a => a.exercise === ex.exercise);
      if (!mine.length) return ex;
      const dSets = clampInt(mine.reduce((s, a) => s + a.setsDelta, 0), -1, 1);
      const dReps = clampInt(mine.reduce((s, a) => s + a.repsDelta, 0), -2, 2);
      const cap = Math.max(1, Math.ceil((config.maxes[ex.exercise] ?? 0) * 0.85));

      let sets = ex.sets.map(s => (s.status === 'pending' ? { ...s, targetReps: clamp(s.targetReps + dReps, 1, cap) } : s));
      if (sets.every(s => s.status === 'pending')) {          // only reshape untouched exercises
        if (dSets > 0 && sets.length < 8) sets = [...sets, { ...sets[sets.length - 1] }];
        if (dSets < 0 && sets.length > 2) sets = sets.slice(0, -1);
      }
      return { ...ex, sets };
    }),
  }));
  return { ...week, days, coachApplied: true, adjustments: adj };
}