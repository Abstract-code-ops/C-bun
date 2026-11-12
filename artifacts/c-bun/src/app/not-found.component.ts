import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-not-found",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <p class="eyebrow"><span class="eyebrow-line"></span>404 · PAGE NOT FOUND</p>
      <h1>This route is<br /><span>still yours to make.</span></h1>
      <p>Add a route in <code>src/app/app.routes.ts</code>, or head back to the starter.</p>
      <a class="button button-primary" routerLink="/">Back to home <span aria-hidden="true">→</span></a>
    </section>
  `,
})
export class NotFoundComponent {}
