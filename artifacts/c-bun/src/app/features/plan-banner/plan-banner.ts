import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Nav } from '../../core/nav';
import { PlanSession } from '../../core/plan-session';
import { PlanStore } from '../../core/plan-store';
import { SetRecorder } from '../../core/set-recorder';
import { EX_LABEL } from '../../utils/plan-format';

@Component({
  selector: 'app-plan-banner',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    @let n = s.next();
    @if (s.active()) {
      <mat-card class="banner">
        @if (s.resting()) {
          <mat-card-content>
            <div class="eyebrow">Rest</div>
            <div class="big">{{ mmss(s.restLeft()) }}</div>
            <mat-progress-bar mode="determinate" [value]="restPct()" />
            @if (s.lastResult(); as r) {
              <p class="line">Last set: <b>{{ r.doneReps }}</b> / {{ r.targetReps }} reps {{ r.doneReps >= r.targetReps ? '✓' : '' }}</p>
            }
            @if (n) {
              <p class="line dim">Next: {{ label[n.exercise] }} · set {{ n.setNumber }}/{{ n.setCount }} · {{ n.targetReps }} reps</p>
            }
          </mat-card-content>
          <mat-card-actions class="actions">
            <button mat-stroked-button (click)="s.skipRest()">Skip rest</button>
            <button mat-button (click)="s.end()">End workout</button>
          </mat-card-actions>
        } @else if (n) {
          <mat-card-content>
            <div class="eyebrow">{{ label[n.exercise] }} · set {{ n.setNumber }} of {{ n.setCount }}</div>
            <div class="big">{{ n.targetReps }} <small>reps</small></div>
            <div class="dots">
              @for (d of dots(); track $index) {
                <span class="dot" [class.done]="d === 'done'" [class.skip]="d === 'skipped'" [class.cur]="$index === n.setIndex"></span>
              }
            </div>
            @if (rec.mode() === 'max') {
              <p class="warn">Switch to “Free set” so this set counts toward the plan.</p>
            } @else {
              <p class="line dim">Do clean reps. Stopping at failure is fine.</p>
            }
          </mat-card-content>
          <mat-card-actions class="actions">
            <button mat-button (click)="s.skipSet()">Skip set</button>
            <button mat-button (click)="s.end()">End workout</button>
          </mat-card-actions>
        } @else {
          <mat-card-content class="done">
            <mat-icon class="trophy">emoji_events</mat-icon>
            <div class="big sm">Workout complete</div>
            <p class="line dim">Nice work. See you at the next session.</p>
          </mat-card-content>
          <mat-card-actions class="actions">
            <button mat-flat-button (click)="finish()">Done</button>
          </mat-card-actions>
        }
      </mat-card>
    } @else if (n) {
      <mat-card class="banner">
        <mat-card-content>
          <div class="eyebrow">Planned workout</div>
          <p class="line">Next up: {{ label[n.exercise] }}, set {{ n.setNumber }}/{{ n.setCount }}, {{ n.targetReps }} reps.</p>
        </mat-card-content>
        <mat-card-actions class="actions">
          <button mat-flat-button (click)="s.begin()"><mat-icon>play_arrow</mat-icon> Start planned workout</button>
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: `
    :host { display: block; }
    .banner { margin: 12px 16px; }
    .eyebrow { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; opacity: .7; }
    .big { font-size: 44px; font-weight: 700; line-height: 1.1; margin: 4px 0 8px; }
    .big small { font-size: 16px; font-weight: 400; opacity: .7; }
    .big.sm { font-size: 24px; }
    .line { margin: 8px 0 0; }
    .dim { opacity: .7; }
    .warn { margin: 8px 0 0; color: var(--mat-sys-error, #ffb4ab); }
    .actions { padding: 4px 16px 16px; display: flex; gap: 8px; }
    .dots { display: flex; gap: 6px; }
    .dot { width: 12px; height: 12px; border-radius: 6px; border: 1px solid var(--mat-sys-outline, #777); }
    .dot.done { background: var(--mat-sys-primary, #8ab4ff); border-color: transparent; }
    .dot.skip { opacity: .35; }
    .dot.cur { border-color: var(--mat-sys-primary, #8ab4ff); border-width: 2px; }
    .done { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .trophy { font-size: 40px; width: 40px; height: 40px; color: var(--mat-sys-primary, #8ab4ff); }
  `,
})
export class PlanBanner {
  readonly s = inject(PlanSession);
  readonly rec = inject(SetRecorder);
  private readonly ps = inject(PlanStore);
  private readonly nav = inject(Nav);
  readonly label = EX_LABEL;

  readonly restPct = computed(() => {
    const t = this.s.restTotal();
    return t ? ((t - this.s.restLeft()) / t) * 100 : 0;
  });

  /** Status of each set of the exercise currently targeted. */
  readonly dots = computed(() => {
    const st = this.ps.state();
    const n = this.s.next();
    return st?.kind === 'workout' && n ? st.day.exercises[n.exIndex].sets.map(x => x.status) : [];
  });

  mmss(sec: number) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

  finish() {
    this.s.end();
    this.nav.go('today');
  }
}