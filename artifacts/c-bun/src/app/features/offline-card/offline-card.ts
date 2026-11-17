import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { interval } from 'rxjs';
import { Connectivity } from '../../core/connectivity';
import { StorageInfo } from '../../core/storage-info';
import { Updates } from '../../core/updates';

@Component({
  selector: 'app-offline-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Offline</mat-card-title>
        <mat-card-subtitle>Works without internet after the first load.</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="rows">
        <div class="row">
          <mat-icon>{{ conn.online() ? 'cloud_done' : 'cloud_off' }}</mat-icon>
          <span>{{ conn.online() ? 'Online' : 'Offline' }}</span>
        </div>
        <div class="row">
          <mat-icon>{{ info.packReady() ? 'download_done' : 'downloading' }}</mat-icon>
          <span>{{ packText() }}</span>
        </div>
        @if (updates.enabled && !info.packReady() && conn.online()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="row"><mat-icon>storage</mat-icon><span>{{ storageText() }}</span></div>
        <div class="row">
          <mat-icon>{{ info.persisted() ? 'lock' : 'lock_open' }}</mat-icon>
          <span>{{ info.persisted() ? 'Data protected from cleanup' : 'Data may be cleared by the browser' }}</span>
        </div>
      </mat-card-content>
      <mat-card-actions class="actions">
        @if (!info.persisted()) {
          <button mat-stroked-button (click)="info.requestPersist()">Protect my data</button>
        }
        <button mat-stroked-button (click)="info.refresh()">Refresh</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host { display: block; margin-top: 12px; }
    .rows { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; }
    .row { display: flex; align-items: center; gap: 12px; }
    .row mat-icon { color: var(--mat-sys-primary, #00e5a0); flex: none; }
    .actions { padding: 8px 16px 16px; display: flex; gap: 8px; }
  `,
})
export class OfflineCard {
  protected readonly conn = inject(Connectivity);
  protected readonly info = inject(StorageInfo);
  protected readonly updates = inject(Updates);

  protected readonly first = this.info.refresh();
  /** Keeps checking while the pack is still downloading. */
  protected readonly poll = interval(3000)
    .pipe(takeUntilDestroyed())
    .subscribe(() => { if (!this.info.packReady()) void this.info.refresh(); });

  protected readonly packText = computed(() => {
    if (!this.updates.enabled) return 'Offline pack: only in the production build (not in dev mode).';
    return this.info.packReady()
      ? 'Offline pack ready: pose model and engine are cached.'
      : 'Downloading offline pack (about 21 MB, first launch only)…';
  });

  protected readonly storageText = computed(() => {
    const u = this.info.usedMb(), q = this.info.quotaMb();
    return u === null ? 'Storage: unavailable' : `Storage used: ${u} MB${q ? ' of ' + q + ' MB' : ''}`;
  });
}