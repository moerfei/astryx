# Pitfalls

Read when an Astryx setup or a component behaves unexpectedly.

## Invocation

- `npx astryx` resolves to an unrelated npm package. Use `npx @astryxdesign/cli@<version>` or a local/global `astryx`.
- Version skew: Core, CLI, and theme must match. `astryx upgrade` moves every package the app lists to one release; each theme names the exact Core release it works with.
- Global vs project: a global CLI answers outside projects; inside a project the project's own version answers. Neither silently upgrades the other.
- Outside a project the CLI caches its release per user on first use; the first run may download.

## Beta churn

- 0.7.x, no 1.0 API promise. Charts and Vega publish only under `@canary`; `astryx experimental` may change in a patch.
- Pin exact versions in the lockfile. Read `astryx docs migration` before bumping.

## Imports

- Component subpaths only (`@astryxdesign/core/Button`). `IconButton` is its own entry, not a Button export.
- Hooks come from the entry each hook's doc prints (commonly `@astryxdesign/core/hooks`).
- Theme provider: `@astryxdesign/core/theme`. Base CSS: `@astryxdesign/core/astryx.css`. Reset: `@astryxdesign/core/reset.css`.

## Styling

- No StyleX build plugin is required to consume the library. If the project also writes StyleX, follow `astryx docs styling`.
- Cascade layers: unlayered CSS overrides `astryx-base` regardless of specificity. With Tailwind or a legacy reset, declare layer order explicitly; see the cascade sections of `astryx docs migration/migration-setup`.
- Don't restyle Button's `::before`. Under a coarse primary pointer the press state paints on that pseudo-element (`z-index: -1`, animated opacity), so a rule there merges into the press layer. Style a child element instead. (From Button's own doc.)
- Disabled controls use `aria-disabled`, not native `disabled`, so focus is retained. Don't assert `disabled` in tests.

## Behavior

- `clickAction` shows loading while its promise is pending; `isInterruptible` lets a re-click interrupt it. Don't stack your own pending flag on top.
- IME: `isComposing` alone misses some IMEs and older Safari, which report only `keyCode === 229`. Keep both signals when writing your own handler.

## Setup edge cases

- `astryx init` is a no-op/refused in the home folder and in settings folders outside a project. Run it at the project root.
- Init writes managed blocks into `AGENTS.md`/`CLAUDE.md` and friends. Edit outside the markers; `--remove-agents` removes only the blocks.
- If an agent file path resolves outside the project, init writes no agent docs (path safety).

## Review claims

- Docs describe intent, not proof. Verify with build/tests. `astryx docs is-my-code-good` requires evidence for every claim.
