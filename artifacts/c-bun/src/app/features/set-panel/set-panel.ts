import { Component, computed, inject, input } from '@angular/core';
import { MotionChart } from '../../shared/motion-chart/motion-chart';
import { ExerciseConfig } from '../../core/exercises';
import { SetRecorder } from '../../core/set-recorder';
import { Store } from '../../core/store';

@Component({
  selector: 'app-set-panel',
  imports: [MotionChart],
  template: `
  <section class="panel">
    @switch (rec.state()) {
      @case ('idle') {
        <div class="seg">
          <button type="button" [class.on]="rec.mode() === 'free'" (click)="rec.mode.set('free')">Free set</button>
          <button type="button" [class.on]="rec.mode() === 'max'" (click)="rec.mode.set('max')">Max test</button>
        </div>
        @if (rec.mode() === 'max') {
          <p class="note">Do as many clean reps as you can. The test ends after 8 s with no rep, or tap End set.
            Current max: <strong>{{ currentMax() ?? 'none' }}</strong></p>
        }
        <button type="button" class="primary" [disabled]="!active()"
                (click)="rec.start(exercise(), rec.mode())">Start set</button>
        @if (!active()) { <p class="note">Start the camera first.</p> }
      }
      @case ('countdown') {
        <div class="big">{{ rec.countdown() }}</div>
        <p class="note">Get into position…</p>
        <button type="button" (click)="rec.end()">Cancel</button>
      }
      @case ('recording') {
        <div class="live">
          <span>{{ clock(rec.elapsedSec()) }}</span>
          <strong>{{ liveCount() }} reps</strong>
        </div>
        <app-motion-chart [points]="rec.livePoints()" [windowMs]="12000"
                          [thresholds]="exercise().thresholds" [reps]="rec.reps()" />
        <button type="button" class="primary" (click)="rec.end()">End set</button>
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
            <p class="win">New personal max!</p>
          }
        }
        @if (rec.result(); as r) {
          <app-motion-chart [points]="r.trace" [thresholds]="exercise().thresholds" [reps]="r.reps" />
        }
        <div class="row">
          <button type="button" class="primary" (click)="rec.save(false)">Save set</button>
          @if (rec.mode() === 'max') {
            <button type="button" class="primary" [disabled]="!stats()?.reps" (click)="rec.save(true)">Save as max</button>
          }
          <button type="button" (click)="rec.discard()">Discard</button>
        </div>
      }
    }

    @if (shownReps().length) {
      <table class="reps">
        <thead><tr><th>Rep</th><th>Total</th><th>Closing</th><th>Opening</th></tr></thead>
        <tbody>
          @for (r of shownReps(); track r.endMs) {
            <tr [class.partial]="!r.counted">
              <td>{{ r.counted ? r.index : '×' }}</td>
              <td>{{ sec(r.totalMs) }}</td>
              <td>{{ r.counted || r.gateMissed ? sec(r.downMs) : '–' }}</td>
              <td>{{ r.counted || r.gateMissed ? sec(r.upMs) : '–' }}</td>
            </tr>
          }
        </tbody>
      </table>
      <p class="note">Closing = angle shrinking (lowering for squats and push-ups, pulling for pull-ups). × = partial rep, not counted.</p>
    }
  </section>
  `,
  styles: `
    :host { display: block; margin-top: 16px; }
    .panel { display: flex; flex-direction: column; gap: 10px; }
    .seg, .row { display: flex; gap: 8px; }
    button { flex: 1; padding: 14px; font-size: 16px; border-radius: 10px; border: 0; background: #2a2a2a; color: #fff; }
    button.on { background: #00e5a0; color: #000; font-weight: 700; }
    button.primary { background: #00e5a0; color: #000; font-weight: 700; }
    button:disabled { opacity: .4; }
    .note { margin: 0; font: 13px system-ui; opacity: .75; }
    .big { font: 800 96px/1 system-ui; text-align: center; }
    .live { display: flex; justify-content: space-between; font: 600 20px system-ui; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
    .stats strong { display: block; font: 700 22px system-ui; }
    .stats span { font: 12px system-ui; opacity: .7; }
    .win { margin: 0; font: 700 16px system-ui; color: #00a870; }
    table { width: 100%; border-collapse: collapse; font: 14px system-ui; }
    th, td { text-align: center; padding: 6px 4px; border-bottom: 1px solid #8884; }
    tr.partial { color: #d33; }
  `,
})
export class SetPanel {
  protected readonly rec = inject(SetRecorder);
  private readonly store = inject(Store);

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

  protected sec(ms: number): string { return (ms / 1000).toFixed(1) + 's'; }
  protected clock(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
