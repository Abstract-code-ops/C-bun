import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MotionChart } from '../../shared/motion-chart/motion-chart';
import { RepTable } from '../../shared/rep-table/rep-table';
import { EXERCISES } from '../../core/exercises';
import { Store } from '../../core/store';
import { SetRecord, countedReps } from '../../core/models';

@Component({
  selector: 'app-history-view',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatExpansionModule, MatIconModule, MotionChart, RepTable],
  template: `
    <h2>Personal bests</h2>
    <div class="maxes">
      @for (ex of exercises; track ex.id) {
        <mat-card appearance="outlined">
          <mat-card-content class="max">
            <span>{{ ex.label }}</span>
            <strong>{{ store.maxes()[ex.id]?.reps ?? '–' }}</strong>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <div class="head">
      <h2>Sets</h2>
      <button mat-stroked-button (click)="download()" [disabled]="!store.sets().length">
        <mat-icon>download</mat-icon> Export
      </button>
    </div>

    @if (!store.sets().length) { <p class="note">No saved sets yet.</p> }

    <mat-accordion>
      @for (s of store.sets(); track s.id) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>{{ label(s.exerciseId) }} · {{ reps(s) }} reps</mat-panel-title>
            <mat-panel-description>{{ s.mode === 'max' ? 'Max test' : 'Free' }}
              · {{ s.startedAt | date: 'MMM d, HH:mm' }}</mat-panel-description>
          </mat-expansion-panel-header>

          <ng-template matExpansionPanelContent>
            <div class="body">
              @if (s.trace.length) {
                <app-motion-chart [points]="s.trace" [thresholds]="thresholds(s.exerciseId)" [reps]="s.reps" />
              } @else {
                <p class="note">Motion trace was not kept (storage was full).</p>
              }
              <app-rep-table [reps]="s.reps" />
              <button mat-button (click)="remove(s)"><mat-icon>delete</mat-icon> Delete set</button>
            </div>
          </ng-template>
        </mat-expansion-panel>
      }
    </mat-accordion>
  `,
  styles: `
    :host { display: block; max-width: 640px; margin: 0 auto; padding: 12px; }
    h2 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
    .maxes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .max { display: flex; flex-direction: column; align-items: center; padding-top: 16px; font-size: 13px; }
    .max strong { font-size: 28px; }
    .head { display: flex; justify-content: space-between; align-items: center; }
    .body { display: flex; flex-direction: column; gap: 12px; }
    .note { font-size: 13px; opacity: .75; }
  `,
})
export class HistoryView {
  protected readonly store = inject(Store);
  private readonly snack = inject(MatSnackBar);
  protected readonly exercises = EXERCISES;

  protected label(id: string): string { return EXERCISES.find(e => e.id === id)?.label ?? id; }
  protected thresholds(id: string) { return EXERCISES.find(e => e.id === id)?.thresholds ?? null; }
  protected reps(s: SetRecord): number { return countedReps(s); }

  protected remove(s: SetRecord): void {
    this.store.deleteSet(s.id);
    this.snack.open('Set deleted', 'Undo', { duration: 5000 })
      .onAction().subscribe(() => this.store.restoreSet(s));
  }

  protected download(): void {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
