# Recipes

Concrete command sequences. Component-level detail still comes from `astryx component <Name>`.

## New app (Vite)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-neutral @astryxdesign/cli
npx astryx init
npx astryx theme add neutral
```

Then:

1. `globals.css`:

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
```

2. Root:

```tsx
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from './astryx-themes';

<Theme theme={themes[defaultThemeSlug]}><App /></Theme>
```

For Next.js, Astryx's repo ships complete example apps under `apps/example-nextjs*`; copy their provider placement instead of guessing client boundaries.

## Build a page from a template

```bash
astryx build "analytics dashboard"          # names the template + what it lacks
astryx template dashboard src/pages/Dashboard.tsx
astryx component Card                        # read props before using
```

Keep the scaffold's frame, gaps, and padding; replace content. `astryx template <Block>` supplies a missing block.

## Theme

```bash
astryx theme list                 # available + added
astryx theme add <slug>           # add a built theme
astryx theme use <slug>           # choose the app default
astryx theme template             # annotated local theme source
```

- Custom: `astryx theme template` then `astryx docs author-a-theme` (`defineTheme`, token overrides, component overrides).
- `astryx theme eject <slug>` forks a built theme's source; use only for an independent source fork — otherwise override tokens.
- Dark mode / nested themes / integration themes: `astryx docs use-a-theme`.
- Per-component overridable targets: `astryx theme targets`.

## Migrate an existing app

```bash
astryx docs migration            # Tailwind / shadcn / Radix, incremental
astryx upgrade                   # codemods after a version bump
astryx swizzle --list            # components whose source can be copied
```

Migration is incremental by design: replace component by component, verify, then remove the old styling. Don't rewrite the whole surface at once.

## Diagnose

```bash
astryx doctor                    # project and integration health
astryx manifest --json           # full CLI capability manifest
astryx gap-report <Component>    # report a missing component/feature
astryx discover                  # integrations available to add
```

## Computer-wide agent text (optional)

```bash
astryx init --user               # ~/.agents/skills/astryx/SKILL.md + links into agent skill folders
astryx init --user --remove-agents
```

It does not link into `~/.zcode`; this skill covers that. If both exist, the official file is canonical for the CLI workflow.
