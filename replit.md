# c-bun

An Angular application with routing, strict TypeScript checks, and a live preview.

## Run & Operate

- `pnpm --filter @workspace/c-bun run dev` — run the Angular app
- `pnpm --filter @workspace/c-bun run build` — create a production build
- `pnpm --filter @workspace/c-bun run typecheck` — check Angular templates and TypeScript
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24
- Frontend: Angular 22, standalone components, Angular Router, TypeScript 6
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/angular-starter/src/app/` — Angular shell, routes, and example pages
- `artifacts/angular-starter/angular.json` — Angular build and development server settings
- `artifacts/api-server/` — shared Express API
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — database schema

## Architecture decisions

- The Angular app uses standalone components and Angular Router.
- The app is a web project with a root preview route.

## Product

The c-bun home page links to a workspace guide and includes a not-found route.

## User preferences

_No project-specific preferences recorded._

## Gotchas

- The Angular development server uses the workflow-provided `PORT` and allows proxy hostnames for the Replit preview.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
