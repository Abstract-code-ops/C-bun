import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MotionChart } from '../../shared/motion-chart/motion-chart';
import { EXERCISES } from '../../core/exercises';
import { Store } from '../../core/store';
import { SetRecord, countedReps } from '../../core/models';

@Component({
  selector: 'app-history-view',
  imports: [MotionChart, DatePipe],
  template: `
  <section class="wrap">
    <h2>Personal bests</h2>
    <div class="maxes">
      @for (ex of exercises; track ex.id) {
        <div class="max"><span>{{ ex.label }}</span><strong>{{ store.maxes()[ex.id]?.reps ?? '–' }}</strong></div>
      }
    </div>

    <div class="head">
      <h2>Sets</h2>
      <button type="button" (click)="download()" [disabled]="!store.sets().length">Export JSON</button>
    </div>
    @if (!store.sets().length) { <p class="note">No saved sets yet.</p> }

    @for (s of store.sets(); track s.id) {
      <article class="set">
        <button type="button" class="summary" (click)="toggle(s.id)">
          <span>{{ label(s.exerciseId) }} · {{ s.mode === 'max' ? 'Max test' : 'Free' }}</span>
          <span>{{ reps(s) }} reps · {{ s.startedAt | date: 'MMM d, HH:mm' }}</span>
        </button>
        @if (openId() === s.id) {
          @if (s.trace.length) {
            <app-motion-chart [points]="s.trace" [thresholds]="thresholds(s.exerciseId)" [reps]="s.reps" />
          } @else {
            <p class="note">Motion trace was not kept (storage was full).</p>
          }
          <table>
            <thead><tr><th>Rep</th><th>Total</th><th>Closing</th><th>Opening</th></tr></thead>
            <tbody>
              @for (r of s.reps; track r.endMs) {
                <tr [class.partial]="!r.counted">
                  <td>{{ r.counted ? r.index : '×' }}</td>
                  <td>{{ sec(r.totalMs) }}</td>
                  <td>{{ r.counted || r.gateMissed ? sec(r.downMs) : '–' }}</td>
                  <td>{{ r.counted || r.gateMissed ? sec(r.upMs) : '–' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <button type="button" class="danger" (click)="remove(s.id)">Delete set</button>
        }
      </article>
    }
    @if (store.error(); as e) { <p class="err">{{ e }}</p> }
  </section>
  `,
  styles: `
    :host { display: block; max-width: 640px; margin: 0 auto; }
    h2 { font: 700 18px system-ui; margin: 16px 0 8px; }
    .maxes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .max { background: #2a2a2a; color: #fff; border-radius: 10px; padding: 12px; text-align: center; font: 13px system-ui; }
    .max strong { display: block; font: 800 28px system-ui; color: #00e5a0; }
    .head { display: flex; justify-content: space-between; align-items: center; }
    button { padding: 10px 14px; font-size: 14px; border-radius: 10px; border: 0; background: #2a2a2a; color: #fff; }
    .set { border: 1px solid #8884; border-radius: 10px; margin-bottom: 8px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
    .summary { display: flex; justify-content: space-between; background: transparent; color: inherit; font: 14px system-ui; padding: 6px; }
    table { width: 100%; border-collapse: collapse; font: 13px system-ui; }
    th, td { text-align: center; padding: 4px; border-bottom: 1px solid #8884; }
    tr.partial { color: #d33; }
    .danger { background: #b00020; }
    .note { font: 13px system-ui; opacity: .75; }
    .err { color: #b00020; font: 14px system-ui; }
  `,
})
export class HistoryView {
  protected readonly store = inject(Store);
  protected readonly exercises = EXERCISES;
  protected readonly openId = signal<string | null>(null);

  protected label(id: string): string { return EXERCISES.find(e => e.id === id)?.label ?? id; }
  protected thresholds(id: string) { return EXERCISES.find(e => e.id === id)?.thresholds ?? null; }
  protected reps(s: SetRecord): number { return countedReps(s); }
  protected sec(ms: number): string { return (ms / 1000).toFixed(1) + 's'; }
  protected toggle(id: string): void { this.openId.update(c => (c === id ? null : id)); }

  protected remove(id: string): void {
    this.openId.set(null);
    this.store.deleteSet(id);
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
