import { Service, signal } from '@angular/core';

export type View = 'today' | 'plan' | 'train' | 'history' | 'setup';

@Service()
export class Nav {
  readonly view = signal<View>('today');
  go(v: View) { this.view.set(v); }
}
