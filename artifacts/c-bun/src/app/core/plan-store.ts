import { Service, computed, effect, signal } from '@angular/core';
import { Plan, PlanConfig, PlanExerciseId, PlannedSet } from './plan-models';
import { advancePlan, createPlan, currentWeek, evaluateWeek, todaysWorkout } from '../utils/plan-engine';
import { localIso } from '../utils/plan-format';

const KEY = 'fit.plan.v1';

export interface SetRef { date: string; exIndex: number; setIndex: number }

export interface NextSet extends SetRef {
  exercise: PlanExerciseId;
  targetReps: number;
  restSec: number;
  setNumber: number;      // 1-based within the exercise
  setCount: number;
  exCount: number;
}

function load(): Plan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Plan;
    return Array.isArray(p?.weeks) && p.weeks.length > 0 && p.config ? p : null;
  } catch {
    return null;
  }
}

@Service()
export class PlanStore {
  readonly plan = signal<Plan | null>(load());
  readonly today = signal(localIso());
  readonly error = signal<string | null>(null);

  readonly week = computed(() => { const p = this.plan(); return p ? currentWeek(p) : null; });
  readonly state = computed(() => { const p = this.plan(); return p ? todaysWorkout(p, this.today()) : null; });
  readonly evaluation = computed(() => { const p = this.plan(); return p ? evaluateWeek(p) : null; });

  /** First pending set of today's workout, in plan order. */
  readonly next = computed<NextSet | null>(() => {
    const s = this.state();
    if (s?.kind !== 'workout') return null;
    for (let exIndex = 0; exIndex < s.day.exercises.length; exIndex++) {
      const e = s.day.exercises[exIndex];
      const setIndex = e.sets.findIndex(x => x.status === 'pending');
      if (setIndex >= 0) {
        return {
          date: s.day.date, exIndex, setIndex,
          exercise: e.exercise, targetReps: e.sets[setIndex].targetReps, restSec: e.restSec,
          setNumber: setIndex + 1, setCount: e.sets.length, exCount: s.day.exercises.length,
        };
      }
    }
    return null;
  });

  constructor() {
    effect(() => this.save(this.plan()));

    const refresh = () => this.today.set(localIso());
    document.addEventListener('visibilitychange', refresh);
    setInterval(refresh, 60_000);
  }

  create(startDate: string, maxes: Record<PlanExerciseId, number>): Plan {
    const config: PlanConfig = { startDate, daysPerWeek: 3, maxes: { ...maxes } };
    const id = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
    const plan = createPlan(config, id, new Date().toISOString());
    this.plan.set(plan);
    return plan;
  }

  advance(): void {
    const p = this.plan();
    if (p) this.plan.set(advancePlan(p, evaluateWeek(p)));
  }

  completeSet(ref: SetRef, r: { doneReps: number; quality: number; recordId?: string }) {
    this.patchSet(ref, { status: 'done', doneReps: r.doneReps, quality: r.quality, recordId: r.recordId });
  }

  skipSet(ref: SetRef) {
    this.patchSet(ref, { status: 'skipped' });
  }

  reset(): Plan | null {
    const prev = this.plan();
    this.plan.set(null);
    return prev;
  }

  restore(p: Plan | null) { this.plan.set(p); }

  private patchSet(ref: SetRef, patch: Partial<PlannedSet>) {
    const p = this.plan();
    if (!p) return;
    this.plan.set({
      ...p,
      weeks: p.weeks.map(w =>
        !w.days.some(d => d.date === ref.date) ? w : {
          ...w,
          days: w.days.map(d =>
            d.date !== ref.date ? d : {
              ...d,
              exercises: d.exercises.map((e, ei) =>
                ei !== ref.exIndex ? e : {
                  ...e,
                  sets: e.sets.map((s, si) => (si === ref.setIndex ? { ...s, ...patch } : s)),
                }),
            }),
        }),
    });
  }

  private save(p: Plan | null) {
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
      this.error.set(null);
    } catch {
      this.error.set('Could not save the plan (storage full or blocked).');
    }
  }
}