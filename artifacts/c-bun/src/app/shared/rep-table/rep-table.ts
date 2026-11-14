import { Component, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { RepRecord } from '../../core/models';

@Component({
  selector: 'app-rep-table',
  imports: [MatTableModule],
  template: `
    <table mat-table [dataSource]="reps()" [trackBy]="trackBy">
      <ng-container matColumnDef="rep">
        <th mat-header-cell *matHeaderCellDef>Rep</th>
        <td mat-cell *matCellDef="let r">{{ r.counted ? r.index : '×' }}</td>
      </ng-container>
      <ng-container matColumnDef="total">
        <th mat-header-cell *matHeaderCellDef>Total</th>
        <td mat-cell *matCellDef="let r">{{ sec(r.totalMs) }}</td>
      </ng-container>
      <ng-container matColumnDef="min">
        <th mat-header-cell *matHeaderCellDef>Min</th>
        <td mat-cell *matCellDef="let r">{{ r.minAngle }}°</td>
      </ng-container>
      <ng-container matColumnDef="closing">
        <th mat-header-cell *matHeaderCellDef>Closing</th>
        <td mat-cell *matCellDef="let r">{{ r.counted || r.gateMissed ? sec(r.downMs) : '–' }}</td>
      </ng-container>
      <ng-container matColumnDef="opening">
        <th mat-header-cell *matHeaderCellDef>Opening</th>
        <td mat-cell *matCellDef="let r">{{ r.counted || r.gateMissed ? sec(r.upMs) : '–' }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let r; columns: cols" [class.partial]="!r.counted"></tr>
    </table>
    <p class="note">Closing = angle shrinking (lowering for squats and push-ups, pulling for
      pull-ups). × = partial rep, not counted.</p>
  `,
  styles: `
    :host { display: block; }
    table { width: 100%; background: transparent; }
    th, td { text-align: center; padding: 0 4px; }
    tr.partial td { color: var(--mat-sys-error, #d33); }
    .note { margin: 8px 0 0; font-size: 12px; opacity: .7; }
  `,
})
export class RepTable {
  readonly reps = input.required<RepRecord[]>();
  protected readonly cols = ['rep', 'total', 'min', 'closing', 'opening'];
  protected readonly trackBy = (_: number, r: RepRecord) => r.endMs;

  protected sec(ms: number): string {
    return (ms / 1000).toFixed(1) + 's';
  }
}
