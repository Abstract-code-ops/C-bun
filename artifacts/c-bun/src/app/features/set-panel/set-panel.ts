import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MotionChart } from '../../shared/motion-chart/motion-chart';
import { RepTable } from '../../shared/rep-table/rep-table';
import { ExerciseConfig } from '../../core/exercises';
import { SetRecorder } from '../../core/set-recorder';
import { Store } from '../../core/store';

@Component({
  selector: 'app-set-panel',
  imports: [MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MotionChart, RepTable],
  template: `
  <mat-card appearance="outlined">
    <mat-card-content class="stack">
      @switch (rec.state()) {
        @case ('idle') {
          <mat-button-toggle-group class="full" [value]="rec.mode()"
              (change)="rec.mode.set($event.value)" aria-label="Set type">
            <mat-button-toggle value="free">Free set</mat-button-toggle>
            <mat-button-toggle value="max">Max test</mat-button-toggle>
          </mat-button-toggle-group>
          @if (rec.mode() === 'max') {
            <p class="note">Do as many clean reps as you can. The test ends after 8 s with no rep,
              or tap End set. Current max: <strong>{{ currentMax() ?? 'none' }}</strong></p>
          }
          <button mat-flat-button class="full" [disabled]="!active()"
                  (click)="rec.start(exercise(), rec.mode())">
            <mat-icon>play_arrow</mat-icon> Start set
          </button>
          @if (!active()) { <p class="note">Start the camera first.</p> }
        }
        @case ('countdown') {
          <div class="big">{{ rec.countdown() }}</div>
          <p class="note center">Get into position…</p>
          <button mat-stroked-button (click)="rec.end()">Cancel</button>
        }
        @case ('recording') {
          <div class="live">
            <span>{{ clock(rec.elapsedSec()) }}</span>
            <strong>{{ liveCount() }} reps</strong>
          </div>
          <app-motion-chart [points]="rec.livePoints()" [windowMs]="12000"
                            [thresholds]="exercise().thresholds" [reps]="rec.reps()" />
          <button mat-flat-button (click)="rec.end()"><mat-icon>stop</mat-icon> End set</button>
        }
        @case ('finished') {
          @if (stats(); as s) {
            <div class="stats">
              <div><strong>{{ s.reps }}</strong><span>reps</span></div>
              <div><strong>{{ sec(s.avg) }}</strong><span>avg rep</span></div>
              <div><strong>{{ sec(s.fast) }}</strong><span>fastest</span></div>
              <div><strong>{{ sec(s.slow) }}</strong><span>slowest</span></div>
            </div>
            @if (rec.mode() === 'max' && s.reps > (currentMax() ?? 0)) {
              <p class="win"><mat-icon>emoji_events</mat-icon> New personal max!</p>
            }
          }
          @if (rec.result(); as r) {
            <app-motion-chart [points]="r.trace" [thresholds]="exercise().thresholds" [reps]="r.reps" />
          }
          <div class="actions">
            <button mat-flat-button (click)="save(false)"><mat-icon>save</mat-icon> Save set</button>
            @if (rec.mode() === 'max') {
              <button mat-flat-button [disabled]="!stats()?.reps" (click)="save(true)">
                <mat-icon>emoji_events</mat-icon> Save as max
              </button>
            }
            <button mat-stroked-button (click)="rec.discard()"><mat-icon>delete</mat-icon> Discard</button>
          </div>
        }
      }

      @if (shownReps().length) { <app-rep-table [reps]="shownReps()" /> }
    </mat-card-content>
  </mat-card>
  `,
  styles: `
    :host { display: block; margin-top: 16px; }
    .stack { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; }
    .full { width: 100%; }
    mat-button-toggle-group.full { display: flex; }
    mat-button-toggle { flex: 1; }
    .note { margin: 0; font-size: 13px; opacity: .75; }
    .center { text-align: center; }
    .big { font: 800 96px/1 system-ui; text-align: center; }
    .live { display: flex; justify-content: space-between; font-size: 20px; font-weight: 600; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
    .stats strong { display: block; font-size: 22px; }
    .stats span { font-size: 12px; opacity: .7; }
    .win { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions button { flex: 1; }
  `,
})
export class SetPanel {
  protected readonly rec = inject(SetRecorder);
  private readonly store = inject(Store);
  private readonly snack = inject(MatSnackBar);

  readonly exercise = input.required<ExerciseConfig>();
  readonly active = input(false);

  protected readonly currentMax = computed(() => this.store.maxes()[this.exercise().id]?.reps);
  protected readonly liveCount = computed(() => this.rec.reps().filter(r => r.counted).length);

  protected readonly shownReps = computed(() =>
    this.rec.state() === 'finished'
      ? (this.rec.result()?.reps ?? [])
      : [...this.rec.reps()].reverse());

  protected readonly stats = computed(() => {
    const r = this.rec.result();
    if (!r) return null;
    const t = r.reps.filter(x => x.counted).map(x => x.totalMs);
    const sum = t.reduce((a, b) => a + b, 0);
    return {
      reps: t.length,
      avg: t.length ? sum / t.length : 0,
      fast: t.length ? Math.min(...t) : 0,
      slow: t.length ? Math.max(...t) : 0,
    };
  });

  protected save(asMax: boolean): void {
    const count = this.stats()?.reps ?? 0;
    this.rec.save(asMax);
    const err = this.store.error();
    this.snack.open(
      err ?? (asMax ? `Saved as your max: ${count} reps` : 'Set saved'),
      'OK',
      { duration: err ? 5000 : 2500 },
    );
  }

  protected sec(ms: number): string { return (ms / 1000).toFixed(1) + 's'; }
  protected clock(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
