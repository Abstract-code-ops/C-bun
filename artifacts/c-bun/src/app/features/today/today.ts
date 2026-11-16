import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Nav } from '../../core/nav';
import { PlanStore } from '../../core/plan-store';
import { PlannedDay, PlannedWeek } from '../../core/plan-models';
import { ExerciseRow } from '../../shared/exercise-row/exercise-row';
import { formatDay } from '../../utils/plan-format';
import { PlanSession } from '../../core/plan-session';

@Component({
  selector: 'app-today',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, ExerciseRow],
  template: `
    @if (!ps.plan()) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">flag</mat-icon>
          <h2>No plan yet</h2>
          <p>Record your max reps, then build a 4-week plan around them.</p>
          <button mat-flat-button (click)="nav.go('setup')">Create your plan</button>
        </mat-card-content>
      </mat-card>
    }

    @if (workout(); as w) {
      <mat-card class="card hero">
        <mat-card-content>
          <div class="eyebrow">Week {{ w.week.weekNumber }} · {{ w.week.label }} · {{ pct(w.week) }}% of max</div>
          <div class="head">
            <div>
              <h2>{{ w.done ? 'Done for today' : "Today's workout" }}</h2>
              <p class="sub">{{ w.day.label }} · {{ fmt(w.day.date) }}</p>
            </div>
            <div class="ring">
              <mat-progress-spinner mode="determinate" [value]="ring(w.day)" [diameter]="88" [strokeWidth]="8" />
              <div class="ring-text"><b>{{ doneSets(w.day) }}</b>/{{ totalSets(w.day) }}<small>sets</small></div>
            </div>
          </div>
          @for (e of w.day.exercises; track e.exercise) {
            <app-exercise-row [ex]="e" />
          }
        </mat-card-content>
        <mat-card-actions class="actions">
          <button mat-flat-button class="go" (click)="w.done ? nav.go('train') : session.begin()">
            <mat-icon>play_arrow</mat-icon> {{ w.done ? 'Train more' : 'Start workout' }}
          </button>
        </mat-card-actions>
      </mat-card>
    }

    @if (rest(); as r) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">self_improvement</mat-icon>
          <h2>Rest day</h2>
          @if (r.next) { <p>Next session: {{ r.next.label }}, {{ fmt(r.next.date) }}.</p> }
          @else { <p>This week's sessions are done.</p> }
        </mat-card-content>
      </mat-card>
    }

    @if (upcoming(); as u) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">event</mat-icon>
          <h2>Plan starts {{ fmt(u.startsOn) }}</h2>
          <p>You can look at the schedule in the Plan tab.</p>
          <button mat-stroked-button (click)="nav.go('plan')">Open plan</button>
        </mat-card-content>
      </mat-card>
    }

    @if (weekOver()) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">fact_check</mat-icon>
          <h2>Week complete</h2>
          <p>Review the week to unlock the next one.</p>
          <button mat-flat-button (click)="nav.go('plan')">Review week</button>
        </mat-card-content>
      </mat-card>
    }

    @if (retest()) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">emoji_events</mat-icon>
          <h2>Cycle complete: time to re-test</h2>
          <p>Record new maxes with a Max test, then start the next cycle.</p>
          <div class="two">
            <button mat-flat-button (click)="nav.go('train')">Max test</button>
            <button mat-stroked-button (click)="nav.go('setup')">Next cycle</button>
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: block; padding: 12px 16px 24px; }
    .card { margin-bottom: 12px; }
    .eyebrow { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; opacity: .7; margin-bottom: 8px; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    h2 { margin: 0; font-size: 24px; font-weight: 600; }
    .sub { margin: 2px 0 0; opacity: .7; }
    .ring { position: relative; width: 88px; height: 88px; flex: none; }
    .ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
    .ring-text b { font-size: 22px; }
    .ring-text small { font-size: 11px; opacity: .7; }
    .actions { padding: 8px 16px 16px; }
    .go { width: 100%; height: 52px; font-size: 16px; }
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 24px 8px; }
    .empty p { margin: 0 0 12px; opacity: .75; }
    .big { font-size: 40px; width: 40px; height: 40px; color: var(--mat-sys-primary, #8ab4ff); }
    .two { display: flex; gap: 8px; }
  `,
})
export class Today {
  readonly ps = inject(PlanStore);
  readonly nav = inject(Nav);
  readonly session = inject(PlanSession);

  readonly workout = computed(() => { const s = this.ps.state(); return s?.kind === 'workout' ? s : null; });
  readonly rest = computed(() => { const s = this.ps.state(); return s?.kind === 'rest' ? s : null; });
  readonly upcoming = computed(() => { const s = this.ps.state(); return s?.kind === 'upcoming' ? s : null; });
  readonly weekOver = computed(() => this.ps.state()?.kind === 'week-over');
  readonly retest = computed(() => this.ps.state()?.kind === 'retest');

  fmt = formatDay;
  pct(w: PlannedWeek) { return Math.round(w.intensityPct * 100); }
  totalSets(d: PlannedDay) { return d.exercises.reduce((n, e) => n + e.sets.length, 0); }
  doneSets(d: PlannedDay) { return d.exercises.reduce((n, e) => n + e.sets.filter(s => s.status !== 'pending').length, 0); }
  ring(d: PlannedDay) { const t = this.totalSets(d); return t ? (this.doneSets(d) / t) * 100 : 0; }
}