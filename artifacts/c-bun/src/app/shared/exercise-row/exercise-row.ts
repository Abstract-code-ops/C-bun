import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PlannedExercise } from '../../core/plan-models';
import { EX_ICON, EX_LABEL, summarize } from '../../utils/plan-format';

@Component({
  selector: 'app-exercise-row',
  imports: [MatIconModule],
  template: `
    <div class="row">
      <mat-icon class="ico">{{ icon() }}</mat-icon>
      <div class="main">
        <div class="name">{{ label() }}</div>
        <div class="meta">{{ summary() }} · rest {{ ex().restSec }} s</div>
        @if (ex().note) { <div class="note">{{ ex().note }}</div> }
      </div>
      <div class="dots">
        @for (s of ex().sets; track $index) {
          <span class="dot" [class.done]="s.status === 'done'" [class.skip]="s.status === 'skipped'">{{ s.targetReps }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--mat-sys-outline-variant, #444); }
    .ico { color: var(--mat-sys-primary, #8ab4ff); flex: none; }
    .main { flex: 1; min-width: 0; }
    .name { font-weight: 600; }
    .meta { font-size: 12px; opacity: .7; }
    .note { font-size: 12px; margin-top: 2px; color: var(--mat-sys-tertiary, #e0b36a); }
    .dots { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; max-width: 45%; }
    .dot {
      min-width: 26px; height: 26px; padding: 0 6px; border-radius: 13px; box-sizing: border-box;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; border: 1px solid var(--mat-sys-outline, #666);
    }
    .dot.done { background: var(--mat-sys-primary, #8ab4ff); color: var(--mat-sys-on-primary, #000); border-color: transparent; }
    .dot.skip { opacity: .4; text-decoration: line-through; }
  `,
})
export class ExerciseRow {
  readonly ex = input.required<PlannedExercise>();
  readonly label = computed(() => EX_LABEL[this.ex().exercise]);
  readonly icon = computed(() => EX_ICON[this.ex().exercise]);
  readonly summary = computed(() => summarize(this.ex()));
}