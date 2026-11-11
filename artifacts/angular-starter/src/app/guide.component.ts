import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-guide",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="guide-page">
      <a class="back-link" routerLink="/"><span aria-hidden="true">←</span> Back to home</a>
      <p class="eyebrow"><span class="eyebrow-line"></span>WORKSPACE GUIDE</p>
      <h1>Your foundation,<br /><span>file by file.</span></h1>
      <p class="guide-intro">
        The app uses standalone Angular components, a simple route table, and strict TypeScript settings.
        Start with these files when you make it your own.
      </p>

      <div class="file-list">
        <article class="file-row">
          <span class="file-icon">TS</span>
          <div><h2>src/app/app.component.ts</h2><p>The shared app shell and main navigation.</p></div>
          <span class="file-type">APP SHELL</span>
        </article>
        <article class="file-row">
          <span class="file-icon">↗</span>
          <div><h2>src/app/app.routes.ts</h2><p>Connect URL paths to standalone page components.</p></div>
          <span class="file-type">ROUTES</span>
        </article>
        <article class="file-row">
          <span class="file-icon">◈</span>
          <div><h2>src/app/home.component.ts</h2><p>A working page component to use as your first example.</p></div>
          <span class="file-type">PAGE</span>
        </article>
        <article class="file-row">
          <span class="file-icon">CSS</span>
          <div><h2>src/styles.css</h2><p>Shared styles and responsive layout rules.</p></div>
          <span class="file-type">STYLES</span>
        </article>
      </div>

      <div class="command-card">
        <div>
          <p class="eyebrow">LOCAL DEVELOPMENT</p>
          <h2>Make it yours.</h2>
          <p>Run the app in development mode, or create a production build.</p>
        </div>
        <div class="commands">
          <code><span>$</span> pnpm --filter @workspace/angular-starter run dev</code>
          <code><span>$</span> pnpm --filter @workspace/angular-starter run build</code>
        </div>
      </div>
    </section>
  `,
})
export class GuideComponent {}
