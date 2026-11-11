import { Routes } from "@angular/router";

import { GuideComponent } from "./guide.component";
import { HomeComponent } from "./home.component";
import { NotFoundComponent } from "./not-found.component";

export const routes: Routes = [
  { path: "", component: HomeComponent, title: "Angular Starter" },
  { path: "guide", component: GuideComponent, title: "Workspace guide" },
  { path: "**", component: NotFoundComponent, title: "Page not found" },
];
