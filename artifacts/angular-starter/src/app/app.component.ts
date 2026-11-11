import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" routerLink="/" aria-label="Angular Starter home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M24 3 4 10.2l3.1 25.6L24 45l16.9-9.2L44 10.2 24 3Z" fill="#DD0031" />
              <path d="M24 8.3v31.4l13.1-7.1 2.3-20.4L24 8.3Z" fill="#C3002F" />
              <path d="m24 8.3-15.4 3.9 2.3 20.4L24 39.7V8.3Z" fill="#fff" />
              <path d="m24 12.1-9.6 21.2h3.6l1.9-4.7h8.2l1.9 4.7h3.6L24 12.1Zm0 7.7 2.8 6.1h-5.6l2.8-6.1Z" fill="#DD0031" />
            </svg>
          </span>
          <span>Angular <span class="brand-light">Starter</span></span>
        </a>

        <nav class="main-nav" aria-label="Main navigation">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/guide" routerLinkActive="active">Workspace guide</a>
        </nav>

        <span class="version-pill"><span class="status-dot"></span>Angular 22</span>
      </header>

      <main>
        <router-outlet />
      </main>

      <footer class="site-footer">
        <span>Built with Angular</span>
        <span class="footer-separator" aria-hidden="true"></span>
        <span>Ready for your next idea</span>
      </footer>
    </div>
  `,
})
export class AppComponent {}
