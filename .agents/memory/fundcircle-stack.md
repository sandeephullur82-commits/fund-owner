---
name: FundCircle stack and routing
description: Vite+React+TS+Tailwind v4+Clerk+Firestore project structure, path aliases, and known type-checking gotchas.
---

- Vite+React+TS+Tailwind v4+Clerk+Firestore; path alias `@` maps to project root (not src/); shared layout components must live in root `components/` (not `src/components/`) to be importable as `@/components/...`.
- `@types/react`/`@types/react-dom` are NOT in package.json by default even though React 19 is used — without them, `tsc --noEmit` silently loses JSX prop checking (extra/missing props go unchecked) except for oddly-specific excess-property-check errors on inline-typed components used with a `key` prop. Install `@types/react@^19` + `@types/react-dom@^19` as devDependencies to get real type-checking; several latent bugs (ClerkProvider prop names, useEffect returning non-void cleanup, missing status union members) only surface once these are installed.
- ClerkProvider in this project must use `signInFallbackRedirectUrl`/`signUpFallbackRedirectUrl`, not `fallbackRedirectUrl` (not a valid prop on the installed Clerk version).
