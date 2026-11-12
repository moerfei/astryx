# Astryx for ZCode

A ZCode plugin for [Astryx](https://github.com/meta/astryx), Meta's open-source design system (React 19 + StyleX, currently Beta 0.7.x).

It packages three things:

- **Read-only MCP server** over the `astryx` CLI — component APIs, docs, templates, themes, and diagnostics as typed tools.
- **`/astryx` command** — search, read the authoritative component doc, implement, then verify.
- **`astryx` skill** — version discipline, query rules, IME safety, and delivery checks.

## MCP tools

| Tool | Purpose |
|---|---|
| `astryx_search` | Search components, hooks, docs, templates, and themes in one ranked list |
| `astryx_component` | Props, variants, import path, theming targets, accessibility |
| `astryx_docs` | Any docs topic or section (`theme`, `tokens`, `migration`, …) |
| `astryx_templates` | List templates or show one template's component set |
| `astryx_themes` | Available themes, added/default state |
| `astryx_build` | Recommend a starting template for a page idea |
| `astryx_doctor` | Diagnose the project's Astryx setup |
| `astryx_manifest` | Machine-readable CLI capability manifest |

All tools are annotated `readOnlyHint: true`. Scaffolding, `theme add`, and `init` stay with the CLI.

## Requirements

- ZCode
- Node.js 22+
- Astryx 0.7.x in the target project. Outside a project the server falls back to `npx @astryxdesign/cli@0.7.14`; the first run may download it.

## Install as a local plugin

Clone this repository next to your local marketplace, then register it:

```bash
git clone https://github.com/moerfei/astryx.git <your-plugins-dir>/astryx
```

Add to `<your-plugins-dir>/marketplace.json`:

```json
{
  "name": "astryx",
  "source": "./astryx",
  "version": "0.1.0"
}
```

Refresh the local marketplace in ZCode and install **Astryx 设计系统**.

## CLI resolution

1. `ASTRYX_CLI` environment variable, if set.
2. The project's own `node_modules/@astryxdesign/cli` (version reported by the project).
3. `npx @astryxdesign/cli@<ASTRYX_CLI_VERSION>` (default `0.7.14`).

This keeps the tools aligned with the project instead of a floating latest release.

## Notes

- Astryx is Beta; minor releases can change props. Keep Core, CLI, and theme on the same version and upgrade with `astryx upgrade`.
- `--zh` output exists only for translated docs; the server falls back to English.
- This plugin is not affiliated with Meta. Astryx is MIT-licensed.

## License

MIT. See [LICENSE](LICENSE).
