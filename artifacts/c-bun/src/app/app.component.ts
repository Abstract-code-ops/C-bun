import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Nav, View } from './core/nav';
import { HistoryView } from './features/history-view/history-view';
import { LiveView } from './features/live-view/live-view';
import { PlanView } from './features/plan-view/plan-view';
import { Setup } from './features/setup/setup';
import { Today } from './features/today/today';
import { Connectivity } from './core/connectivity';
import { Updates } from './core/updates';

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, Today, PlanView, LiveView, HistoryView, Setup],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly nav = inject(Nav);
  protected readonly conn = inject(Connectivity);
  protected readonly updates = inject(Updates);
  readonly tabs: { id: View; icon: string; label: string }[] = [
    { id: 'today', icon: 'today', label: 'Today' },
    { id: 'plan', icon: 'calendar_month', label: 'Plan' },
    { id: 'train', icon: 'videocam', label: 'Train' },
    { id: 'history', icon: 'history', label: 'History' },
  ];
}
