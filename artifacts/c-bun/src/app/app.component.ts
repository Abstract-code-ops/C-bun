import { Component } from '@angular/core';
import { LiveView } from './features/live-view/live-view';
import { signal } from '@angular/core';
import { HistoryView } from './features/history-view/history-view';
// in the @Component: imports: [LiveView, HistoryView]


@Component({
  selector: 'app-root',
  imports: [LiveView, HistoryView],
  templateUrl: './app.html',
})
export class AppComponent {

  protected readonly view = signal<'train' | 'history'>('train');
}
