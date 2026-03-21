# AGENTS.md

Guidance for agentic coding tools operating in this repository.

## Project Snapshot
- Stack: Astro 6 + TypeScript (strict) + Tailwind CSS 4 + Three.js.
- Package manager: pnpm (`pnpm-lock.yaml` is present).
- Runtime target: Node.js `>=22.12.0` (from `package.json`).
- Main source roots: `src/` (code), `public/` (static assets).
- Build output: `dist/`.

## Repository Layout
- `src/pages/`: Astro route entry points.
- `src/layouts/`: page layouts.
- `src/components/`: Astro components.
- `src/scripts/`: browser-side TypeScript (Three.js scene logic).
- `src/styles/`: global styles (`globals.css` imports Tailwind).
- `src/assets/`: project assets including 3D `.glb` files.

## Commands (Build / Lint / Test)

### Install
- `pnpm install`

### Development
- `pnpm dev` — run Astro dev server.
- `pnpm preview` — preview built output.

### Build
- `pnpm build` — production build to `dist/`.

### Type checking / Astro checks
- `pnpm astro check` — run Astro + TypeScript checks.

### Lint / format
This repo has `biome.json` but no lint script in `package.json`.

- Check formatting/lint-like issues (non-mutating):
  - `pnpm dlx @biomejs/biome check .`
- Apply formatting/safe fixes:
  - `pnpm dlx @biomejs/biome check --write .`

### Tests
Current status:
- No test framework or test scripts are configured in `package.json`.
- There is no built-in `pnpm test` command right now.

Single-test execution:
- Not applicable in current repo state (no test runner configured).

If tests are added later (recommended: Vitest), use:
- All tests: `pnpm vitest run`
- Single file: `pnpm vitest run path/to/file.test.ts`
- Single test name: `pnpm vitest run path/to/file.test.ts -t "test name"`

## Agent Workflow (Recommended)
- After code edits, run at minimum:
  1. `pnpm astro check`
  2. `pnpm build`
- If Biome is available, also run:
  3. `pnpm dlx @biomejs/biome check .`
- Prefer small focused changes; avoid broad refactors unless requested.

## Code Style Guidelines

### General
- Prefer TypeScript for logic in `src/scripts/`.
- Keep Astro components focused on markup/composition.
- Follow existing file organization and naming patterns.
- Use descriptive names tied to scene/domain behavior.

### Imports
- Use ES modules only.
- Use `import type` for type-only imports (seen in `parallax/pointer.ts`).
- Keep import groups ordered as:
  1. External packages (`three`, `motion`, etc.)
  2. Absolute/aliased imports (if introduced)
  3. Relative local imports
- Keep asset URL imports explicit (e.g. `?url` for GLB assets).

### Formatting
- Existing TS style uses:
  - semicolons,
  - double quotes,
  - trailing commas in multiline structures.
- Keep line length readable; split long calls across lines.
- Astro files in this repo commonly use 4-space indentation in markup.
- TS files mostly use 2-space indentation; preserve surrounding style.
- Do not introduce unrelated formatting churn.

### Types
- `tsconfig.json` extends `astro/tsconfigs/strict`; maintain strict typing.
- Avoid `any`; prefer explicit interfaces/types.
- Export interfaces for reusable contracts (e.g. `BoatController`).
- Model optional config via options objects with defaults.
- Narrow nullable DOM lookups (`HTMLCanvasElement | null`) before use.

### Naming conventions
- Components/layouts/pages: PascalCase for Astro component files.
- Utility/scene modules: camelCase file names prefixed with verbs (`createX`).
- Variables/functions: camelCase.
- Types/interfaces: PascalCase.
- Use semantically meaningful names (`boatLightingController`, not `blc`).

### Error handling
- Wrap async asset loads in `try/catch` at composition boundaries.
- Log errors with clear context messages (current pattern uses `console.error`).
- Prefer degrading gracefully instead of crashing full scene init.
- Keep failure scope local: one failed asset should not block unrelated setup.

### Three.js / rendering-specific practices
- Reuse loaders/materials when reasonable.
- Keep update loops lightweight; avoid allocations inside hot paths.
- Clamp expensive renderer settings when possible (`pixelRatio <= 2` pattern exists).
- Separate scene creation into focused modules (`createSky`, `createLake`, etc.).

### Astro practices
- Keep page assembly in `src/pages/index.astro` simple and declarative.
- Import global styles once from page/layout boundary.
- Prefer composition over large monolithic Astro components.

## Files/paths agents should treat carefully
- Do not edit generated/build artifacts:
  - `dist/`
  - `.astro/`
- Do not edit dependencies:
  - `node_modules/`
- Asset-heavy files (`src/assets/3D/*.glb`) should only change when explicitly requested.

## Cursor/Copilot Rules
Checked locations:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

Result:
- No Cursor or Copilot instruction files were found in this repository.

If such files are added later, treat them as higher-priority repository-specific guidance and merge them into this document.

## PR / Commit Hygiene for Agents
- Keep commits focused and scoped to the request.
- Include verification notes in PR descriptions (commands + outcomes).
- Mention if checks could not run locally and why.
- Avoid mixing style-only edits with functional changes unless asked.
