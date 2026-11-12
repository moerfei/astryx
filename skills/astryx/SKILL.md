---
name: astryx
description: Build, review, or debug React UI with Meta's Astryx design system (@astryxdesign/core, StyleX, React 19+). Use when adding or changing Astryx components, choosing components or page templates, theming, migrating to Astryx, or working in a project that depends on @astryxdesign packages — look up the installed version's docs through the astryx CLI instead of guessing props.
---

# Astryx

Astryx is Meta's open-source design system: 150+ accessible React 19 components, StyleX for internal styling, MIT-licensed, currently Beta 0.7.x. The `astryx` CLI serves the authoritative component APIs, hooks, tokens, templates, and themes. This skill carries the ZCode-side discipline: query before writing, pin versions, and verify before delivering.

## Ground rules

- **Never guess an API.** Run `astryx search '<what you need>'`, then `astryx component <Name>`, `astryx hook <name>`, or `astryx docs <topic>`. Read CLI output — not `node_modules` internals, not this file.
- **Use the project's CLI.** Inside a project, `astryx` resolves to the local version. Outside one, pin: `npx @astryxdesign/cli@0.7.14 <command>`. Never run bare `npx astryx`; that npm name is an unrelated package.
- **Pin, don't float.** Astryx has no 1.0 API promise; minor releases can change props. Keep `@astryxdesign/core` and `@astryxdesign/cli` on the same version and upgrade with `astryx upgrade` (codemods) rather than hand-editing. Each theme names the Core release it supports.
- **Docs live at runtime.** Don't vendor component docs into the project; they drift with the installed version.

## Query cheaply

Full reads are verbose. When you only need structure, use:

```bash
astryx --dense component Button    # token-efficient text
astryx --zh component Button       # Chinese where a translation exists
astryx --json component Button     # {apiVersion, type, package?, data, meta?}
astryx --detail brief component    # list mode
```

`--json` errors return `{apiVersion, error, code, suggestions?}`. Use `--zh` when the user works in Chinese and a translation exists; fall back to English otherwise.

If the Astryx ZCode plugin is installed, prefer its MCP tools (`astryx_search`, `astryx_component`, `astryx_docs`, `astryx_templates`, `astryx_themes`, `astryx_build`, `astryx_doctor`, `astryx_manifest`): same data, typed, and scoped to the project's CLI. Fall back to the commands above when they are unavailable.

## Set up a project

React 19+ is a hard peer requirement. Consumers need no StyleX build plugin, PostCSS, or Babel config; the library ships compiled CSS.

```bash
npm install @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-neutral @astryxdesign/cli
npx astryx init                    # writes the agent cheat sheet (AGENTS.md/CLAUDE.md); --all adds theme/template pointers
```

Global CSS:

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
```

Then `astryx theme add neutral` generates an `astryx-themes` module, and the app root wraps in `<Theme theme={themes[defaultThemeSlug]}>` from `@astryxdesign/core/theme`.

Seven prebuilt themes ship (neutral, butter, chocolate, matcha, stone, gothic, y2k); `astryx theme list` is authoritative. Dark mode, nested themes, and custom themes: `astryx docs use-a-theme`, `astryx docs author-a-theme`.

**Cascade layers:** the reset loads in `@layer reset`, component styles in `@layer astryx-base`. If the project has Tailwind, a legacy reset, or existing global CSS, declare the layer order explicitly; unlayered styles override `astryx-base` regardless of specificity. Read the cascade sections of `astryx docs migration/migration-setup` before adding styles.

## Build

- **Start from a template.** `astryx build "<idea>"` names the template to scaffold and the parts it lacks; `astryx template <name> <path>` scaffolds it. Keep the frame, gap, and padding; replace the content. `astryx template --list` lists all.
- **Import per component entry:** `import {Button} from '@astryxdesign/core/Button'`. Root imports and guessed file paths are not the contract.
- **Compose before restyling.** Use documented props and variants; `className`/`xstyle` are for genuine gaps.
- **Tokens over literals.** Colors, spacing, type, radius, shadow, motion come from tokens (`astryx docs tokens`). Replace raw `#hex` and `px` when a token exists.
- **Prefer behavior props to hand-rolled state.** E.g. Button's `isLoading`/`isDisabled`/`isInterruptible` already handle focus retention and live-region announcements. Read the component doc before inventing state logic.
- **IME safety.** Any custom Enter/Escape keydown handler must ignore composition: `isComposing || keyCode === 229`. Astryx components already guard their own handlers — don't double-wrap. This matters for Chinese/Japanese/Korean input, where Enter commits a candidate.
- **Swizzle is last resort.** `astryx swizzle <Component>` forks source and its maintenance. Prefer theme tokens, `className`, or a wrapper first.

## Before delivering

1. Re-read every changed file. Replace raw `<div>`/`<span>` where a component exists, imported `.css`/`@apply`, hardcoded `#hex`/`px`.
2. Run `astryx doctor` in the project.
3. Build or typecheck, and report the actual output rather than a description of the change.
4. Reviewing an existing surface? `astryx docs is-my-code-good` is the official rubric; require evidence for each claim.

## ZCode notes

- Two carriers exist: this standalone skill (`~/.zcode/skills/astryx/`) and the `astryx` ZCode plugin (`skills/` + `/astryx` command + read-only MCP tools). If the plugin is installed, its copy and MCP tools are canonical; this file is the fallback.
- Astryx's own `astryx init --user` writes `~/.agents/skills/astryx/SKILL.md` and links it into Claude/Kiro/etc., not `~/.zcode`. If that file exists, its `search → component/docs` workflow is canonical; this skill adds the flags, version discipline, and delivery checks.
- If `astryx` is missing, install it once: `npm i -g @astryxdesign/cli`, or keep using the pinned `npx` form.

Deeper traps: [references/pitfalls.md](references/pitfalls.md). Setup and migration recipes: [references/recipes.md](references/recipes.md).
