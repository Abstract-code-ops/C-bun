import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Nav } from '../../core/nav';
import { PlanStore } from '../../core/plan-store';
import { PlannedDay } from '../../core/plan-models';
import { ExerciseRow } from '../../shared/exercise-row/exercise-row';
import { addDays } from '../../utils/plan-engine';
import { formatDay } from '../../utils/plan-format';

type DayStatus = 'done' | 'today' | 'missed' | 'upcoming';

@Component({
  selector: 'app-plan-view',
  imports: [MatCardModule, MatButtonModule, MatButtonToggleModule, MatIconModule, ExerciseRow],
  template: `
    @if (!ps.plan()) {
      <mat-card class="card">
        <mat-card-content class="empty">
          <mat-icon class="big">calendar_month</mat-icon>
          <h2>No plan yet</h2>
          <button mat-flat-button (click)="nav.go('setup')">Create your plan</button>
        </mat-card-content>
      </mat-card>
    } @else {
      @if (ps.plan(); as plan) {
        <mat-button-toggle-group class="weeks" [value]="index()" (change)="picked.set($event.value)" aria-label="Week">
          @for (w of plan.weeks; track $index; let i = $index) {
            <mat-button-toggle [value]="i">W{{ w.weekNumber }}{{ isRepeat(i) ? ' ↻' : '' }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      }

      @if (weekOver() && isLast()) {
        <mat-card class="card verdict">
          <mat-card-header>
            <mat-card-title>Week review</mat-card-title>
            <mat-card-subtitle>{{ ps.evaluation()?.reason }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="stats">
            <div><b>{{ ps.evaluation()?.sessionsDone }}/3</b><span>sessions</span></div>
            <div><b>{{ pct(ps.evaluation()?.completion ?? 0) }}%</b><span>sets hit</span></div>
          </mat-card-content>
          <mat-card-actions class="actions">
            <button mat-flat-button (click)="continue()">{{ continueText() }}</button>
          </mat-card-actions>
        </mat-card>
      }

      @if (ps.plan()?.status === 'retest' && isLast()) {
        <mat-card class="card verdict">
          <mat-card-header>
            <mat-card-title>Cycle complete</mat-card-title>
            <mat-card-subtitle>Re-test your maxes, then start the next cycle.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions class="actions">
            <button mat-flat-button (click)="nav.go('train')">Max test</button>
            <button mat-stroked-button (click)="nav.go('setup')">Next cycle</button>
          </mat-card-actions>
        </mat-card>
      }

      @if (week(); as w) {
        <div class="head">
          <div>
            <h2>Week {{ w.weekNumber }} · {{ w.label }}</h2>
            <p class="sub">{{ fmt(w.startDate) }} – {{ fmt(end(w.startDate)) }} · {{ pctW(w.intensityPct) }}% of max</p>
          </div>
        </div>

        <div class="strip">
          @for (d of w.days; track d.date) {
            <div class="pill" [class]="'pill ' + status(d)">
              <mat-icon>{{ icon(status(d)) }}</mat-icon>
              <span class="d">{{ fmt(d.date) }}</span>
            </div>
          }
        </div>

        @for (d of w.days; track d.date) {
          <mat-card class="card">
            <mat-card-header>
              <mat-card-title>{{ d.label }}</mat-card-title>
              <mat-card-subtitle>{{ fmt(d.date) }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @for (e of d.exercises; track e.exercise) {
                <app-exercise-row [ex]="e" />
              }
            </mat-card-content>
          </mat-card>
        }
      }
    }
  `,
  styles: `
    :host { display: block; padding: 12px 16px 24px; }
    .card { margin-bottom: 12px; }
    .weeks { width: 100%; margin-bottom: 12px; }
    .weeks ::ng-deep .mat-button-toggle { flex: 1; }
    h2 { margin: 0; font-size: 22px; font-weight: 600; }
    .sub { margin: 2px 0 12px; opacity: .7; }
    .strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .pill { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 4px; border-radius: 16px;
            background: var(--mat-sys-surface-container, #222); border: 1px solid var(--mat-sys-outline-variant, #444); }
    .pill .d { font-size: 12px; opacity: .8; }
    .pill.done mat-icon { color: var(--mat-sys-primary, #8ab4ff); }
    .pill.today { border-color: var(--mat-sys-primary, #8ab4ff); }
    .pill.missed { opacity: .6; }
    .verdict { margin-bottom: 16px; }
    .stats { display: flex; gap: 24px; padding-top: 8px; }
    .stats div { display: flex; flex-direction: column; }
    .stats b { font-size: 24px; }
    .stats span { font-size: 12px; opacity: .7; }
    .actions { padding: 8px 16px 16px; display: flex; gap: 8px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; text-align: center; }
    .big { font-size: 40px; width: 40px; height: 40px; color: var(--mat-sys-primary, #8ab4ff); }
  `,
})
export class PlanView {
  readonly ps = inject(PlanStore);
  readonly nav = inject(Nav);

  readonly picked = signal<number | null>(null);

  readonly index = computed(() => {
    const p = this.ps.plan();
    if (!p) return 0;
    const i = this.picked();
    return i !== null && i < p.weeks.length ? i : p.weeks.length - 1;
  });
  readonly week = computed(() => this.ps.plan()?.weeks[this.index()] ?? null);
  readonly isLast = computed(() => this.index() === (this.ps.plan()?.weeks.length ?? 1) - 1);
  readonly weekOver = computed(() => this.ps.state()?.kind === 'week-over');

  readonly continueText = computed(() => {
    const ev = this.ps.evaluation();
    const w = this.ps.week();
    if (!ev || !w) return 'Continue';
    if (ev.decision === 'advance') return `Start week ${w.weekNumber + 1}`;
    if (ev.decision === 'hold') return `Repeat week ${w.weekNumber}`;
    return 'Finish cycle';
  });

  fmt = formatDay;
  end(startIso: string) { return addDays(startIso, 6); }
  pct(x: number) { return Math.round(x * 100); }
  pctW(x: number) { return Math.round(x * 100); }

  isRepeat(i: number): boolean {
    const w = this.ps.plan()?.weeks;
    return !!w && i > 0 && w[i - 1].weekNumber === w[i].weekNumber;
  }

  status(d: PlannedDay): DayStatus {
    if (d.exercises.every(e => e.sets.every(s => s.status !== 'pending'))) return 'done';
    const t = this.ps.today();
    if (d.date === t) return 'today';
    return d.date < t ? 'missed' : 'upcoming';
  }

  icon(s: DayStatus): string {
    return { done: 'check_circle', today: 'radio_button_checked', missed: 'error_outline', upcoming: 'radio_button_unchecked' }[s];
  }

  continue() {
    this.ps.advance();
    this.picked.set(null);
  }
}