import { Component } from '@angular/core';
import { LiveView } from './features/live-view/live-view';

@Component({
  selector: 'app-root',
  imports: [LiveView],
  template: `<app-live-view />`,
})
export class AppComponent {}
