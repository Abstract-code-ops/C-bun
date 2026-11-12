import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span>YOUR ANGULAR WORKSPACE</p>
        <h1>A clean start<br />for <span>big ideas.</span></h1>
        <p class="hero-description">
          Your Angular app is up and running. Explore the starter, then shape it into something yours.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" routerLink="/guide">
            Explore the workspace <span aria-hidden="true">↗</span>
          </a>
          <a class="button button-quiet" href="https://angular.dev" target="_blank" rel="noreferrer">
            Angular docs <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div class="ready-note"><span class="status-dot"></span>All systems ready</div>
      </div>

      <div class="code-window" aria-label="Angular application example">
        <div class="window-bar">
          <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <span>src/app/app.component.ts</span>
          <span class="window-kind">TYPESCRIPT</span>
        </div>
        <pre><code><span class="code-muted">01</span> <span class="code-purple">import</span> &#123; Component &#125; <span class="code-purple">from</span> <span class="code-green">'@angular/core'</span>;

<span class="code-muted">02</span> <span class="code-yellow">@Component</span>(&#123;
<span class="code-muted">03</span>   selector: <span class="code-green">'app-root'</span>,
<span class="code-muted">04</span>   standalone: <span class="code-blue">true</span>,
<span class="code-muted">05</span>   template: <span class="code-green">'&lt;h1&gt;Hello, Angular!&lt;/h1&gt;'</span>,
<span class="code-muted">06</span> &#125;)
<span class="code-muted">07</span> <span class="code-purple">export class</span> <span class="code-yellow">AppComponent</span> &#123;
<span class="code-muted">08</span>   title = <span class="code-green">'your-next-idea'</span>;
<span class="code-muted">09</span> &#125;

<span class="code-muted">10</span> <span class="code-comment">// Your workspace is ready to build.</span></code></pre>
        <div class="window-footer">
          <span><span class="status-dot"></span> TypeScript · Strict mode</span>
          <span>UTF-8</span>
        </div>
      </div>
    </section>

    <section class="starter-section" aria-labelledby="starter-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">THE FOUNDATION</p>
          <h2 id="starter-heading">Everything in place.</h2>
        </div>
        <p class="section-intro">A few useful starting points, already connected.</p>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-icon icon-routes" aria-hidden="true">↗</span>
          <h3>Routing, ready</h3>
          <p>Home and guide pages are connected with Angular Router. Add routes as your app grows.</p>
          <a routerLink="/guide">See the guide <span aria-hidden="true">→</span></a>
        </article>
        <article class="feature-card">
          <span class="feature-icon icon-types" aria-hidden="true">TS</span>
          <h3>Strict by default</h3>
          <p>TypeScript and Angular template checks catch mistakes early, while your code stays manageable.</p>
          <span class="feature-detail">TypeScript 6 · strict templates</span>
        </article>
        <article class="feature-card">
          <span class="feature-icon icon-live" aria-hidden="true">⌁</span>
          <h3>Live preview</h3>
          <p>Save a change and see it appear in your running app, without interrupting your flow.</p>
          <span class="feature-detail">Development server connected</span>
        </article>
      </div>
    </section>
  `,
})
export class HomeComponent {}
