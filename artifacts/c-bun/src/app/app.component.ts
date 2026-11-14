import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveView } from './features/live-view/live-view';
import { HistoryView } from './features/history-view/history-view';

@Component({
  selector: 'app-root',
  imports: [LiveView, HistoryView, MatTabsModule],
  templateUrl: './app.html',
})
export class AppComponent {}
