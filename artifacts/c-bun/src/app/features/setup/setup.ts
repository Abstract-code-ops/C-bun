import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Nav } from '../../core/nav';
import { PlanStore } from '../../core/plan-store';
import { PLAN_EXERCISES, PlanConfig, PlanExerciseId } from '../../core/plan-models';
import { Store } from '../../core/store';
import { ExerciseRow } from '../../shared/exercise-row/exercise-row';
import { buildWeek } from '../../utils/plan-engine';
import { EX_LABEL, formatDay, localIso } from '../../utils/plan-format';
import { OfflineCard } from '../offline-card/offline-card';

type Maxes = Record<PlanExerciseId, number>;

@Component({
  selector: 'app-setup',
  imports: [MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, ExerciseRow, OfflineCard],
  template: `
    @if (ps.plan(); as plan) {
      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>{{ plan.status === 'retest' ? 'Cycle complete' : 'Current plan' }}</mat-card-title>
          <mat-card-subtitle>
            Started {{ fmt(plan.config.startDate) }} · week {{ plan.weeks[plan.weeks.length - 1].weekNumber }} of 4
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="maxes">
            @for (id of ids; track id) {
              <div class="m">
                <span class="l">{{ label[id] }}</span>
                <span class="v">{{ plan.config.maxes[id] }}
                  @if (plan.status === 'retest' && maxes()[id] !== plan.config.maxes[id]) {
                    <mat-icon inline>arrow_forward</mat-icon> {{ maxes()[id] }}
                  }
                </span>
              </div>
            }
          </div>
          @if (plan.status === 'retest') {
            <p class="hint">Do a Max test in Train to update your numbers, then start the next cycle below.</p>
            <button mat-stroked-button (click)="nav.go('train')">Open Train</button>
          }
        </mat-card-content>
        @if (plan.status !== 'retest') {
          <mat-card-actions class="actions">
            <button mat-stroked-button (click)="reset()"><mat-icon>delete</mat-icon> Reset plan</button>
          </mat-card-actions>
        }
      </mat-card>
    }

    @if (showForm()) {
      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>{{ ps.plan() ? 'Next cycle' : 'Create your plan' }}</mat-card-title>
          <mat-card-subtitle>Max clean reps in one set. Record them with a Max test, or type them in.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="form">
          @for (id of ids; track id) {
            <mat-form-field appearance="outline">
              <mat-label>{{ label[id] }}</mat-label>
              <input matInput type="number" inputmode="numeric" min="0" [value]="maxes()[id]" (input)="setMax(id, $event)" />
              <mat-hint>{{ hint(id) }}</mat-hint>
            </mat-form-field>
          }
          <mat-form-field appearance="outline">
            <mat-label>Start date</mat-label>
            <input matInput type="date" [value]="startDate()" (input)="onDate($event)" />
            <mat-hint>3 sessions: day 1, 3 and 5 of each week</mat-hint>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Week 1 preview</mat-card-title>
          <mat-card-subtitle>Each session, 60% of your max</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @for (e of preview().days[0].exercises; track e.exercise) {
            <app-exercise-row [ex]="e" />
          }
        </mat-card-content>
        <mat-card-actions class="actions">
          <button mat-flat-button class="go" (click)="create()">
            {{ ps.plan() ? 'Start next cycle' : 'Create plan' }}
          </button>
        </mat-card-actions>
      </mat-card>
      <app-offline-card />
    }
  `,
  styles: `
    :host { display: block; padding: 12px 16px 24px; }
    .card { margin-bottom: 12px; }
    .form { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; }
    .maxes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 8px; }
    .m { display: flex; flex-direction: column; }
    .l { font-size: 12px; opacity: .7; }
    .v { font-size: 22px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
    .hint { opacity: .75; margin: 12px 0 8px; }
    .actions { padding: 8px 16px 16px; }
    .go { width: 100%; height: 52px; font-size: 16px; }
  `,
})
export class Setup {
  readonly ps = inject(PlanStore);
  readonly nav = inject(Nav);
  private readonly store = inject(Store);
  private readonly snack = inject(MatSnackBar);

  readonly ids = PLAN_EXERCISES;
  readonly label = EX_LABEL;
  fmt = formatDay;

  readonly startDate = signal(localIso());
  private readonly overrides = signal<Partial<Maxes>>({});

  readonly recorded = computed<Maxes>(() => {
    const m = this.store.maxes();
    return { pullup: m['pullup']?.reps ?? 0, pushup: m['pushup']?.reps ?? 0, squat: m['squat']?.reps ?? 0 };
  });
  readonly maxes = computed<Maxes>(() => ({ ...this.recorded(), ...this.overrides() }));

  readonly showForm = computed(() => {
    const p = this.ps.plan();
    return !p || p.status === 'retest';
  });

  readonly preview = computed(() => {
    const config: PlanConfig = { startDate: this.startDate(), daysPerWeek: 3, maxes: this.maxes() };
    return buildWeek(config, 1, this.startDate());
  });

  setMax(id: PlanExerciseId, ev: Event) {
    const n = Math.max(0, Math.floor(Number((ev.target as HTMLInputElement).value) || 0));
    this.overrides.update(o => ({ ...o, [id]: n }));
  }

  onDate(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    if (v) this.startDate.set(v);
  }

  hint(id: PlanExerciseId): string {
    if (this.overrides()[id] !== undefined) return 'Entered manually';
    return this.recorded()[id] > 0 ? 'From your max test' : 'Not recorded yet';
  }

  create() {
    const m = this.maxes();
    if (PLAN_EXERCISES.every(id => m[id] <= 0)) {
      this.snack.open('Record or enter at least one max first.', 'OK', { duration: 4000 });
      return;
    }
    this.ps.create(this.startDate(), m);
    this.overrides.set({});
    this.snack.open('Plan created', undefined, { duration: 2500 });
    this.nav.go('today');
  }

  reset() {
    const prev = this.ps.reset();
    this.snack.open('Plan deleted', 'Undo', { duration: 6000 }).onAction().subscribe(() => this.ps.restore(prev));
  }
}