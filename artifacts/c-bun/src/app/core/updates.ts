import { Service, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';

@Service()
export class Updates {
  private readonly sw = inject(SwUpdate);
  private readonly snack = inject(MatSnackBar);

  readonly enabled = this.sw.isEnabled;
  readonly ready = signal(false);

  protected readonly watch = this.sw.versionUpdates
    .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'), takeUntilDestroyed())
    .subscribe(() => {
      this.ready.set(true);
      this.snack.open('Update ready', 'Reload', { duration: 15000 })
        .onAction().subscribe(() => void this.reload());
    });

  protected readonly poll = interval(10 * 60_000)
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      if (this.sw.isEnabled) void this.sw.checkForUpdate().catch(() => {});
    });

  async reload(): Promise<void> {
    try { await this.sw.activateUpdate(); } catch { /* ignore */ }
    location.reload();
  }
}