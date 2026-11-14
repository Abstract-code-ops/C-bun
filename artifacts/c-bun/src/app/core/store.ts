import { Service, signal } from '@angular/core';
import { SetRecord, UserMax } from './models';

const SETS_KEY = 'fit.sets.v1';
const MAXES_KEY = 'fit.maxes.v1';

@Service()
export class Store {
  readonly sets = signal<SetRecord[]>(this.read<SetRecord[]>(SETS_KEY, []));
  readonly maxes = signal<Record<string, UserMax | undefined>>(
    this.read<Record<string, UserMax | undefined>>(MAXES_KEY, {}));
  readonly error = signal<string | null>(null);

  addSet(s: SetRecord): void {
    this.sets.update(list => [s, ...list]);
    this.persistSets();
  }

  restoreSet(s: SetRecord): void {
    this.sets.update(list => [...list, s].sort((a, b) => b.startedAt - a.startedAt));
    this.persistSets();
  }

  deleteSet(id: string): void {
    this.sets.update(list => list.filter(s => s.id !== id));
    this.persistSets();
  }

  setMax(m: UserMax): void {
    this.maxes.update(x => ({ ...x, [m.exerciseId]: m }));
    this.write(MAXES_KEY, this.maxes());
  }

  exportJson(): string {
    return JSON.stringify({ sets: this.sets(), maxes: this.maxes() }, null, 2);
  }

  private persistSets(): void {
    this.error.set(null);
    if (this.write(SETS_KEY, this.sets())) return;
    // Storage full: keep traces only for the newest 5 sets
    this.sets.update(list => list.map((s, i) => (i < 5 ? s : { ...s, trace: [] })));
    if (!this.write(SETS_KEY, this.sets())) this.error.set('Could not save: storage is full.');
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  }

  private write(key: string, value: unknown): boolean {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
}
