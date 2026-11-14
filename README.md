# Grex Theme Builder (`grex-builder`)

![Built with GRAB v1.1.0](docs/badges/built-with-grab.svg)
![Powered by Grex JS v1.0.0](docs/badges/powered-by-grex-js.svg)

**Grex Theme Builder** is Step 3 of the Post-1.0 **GRAB Ecosystem** — a responsive-first visual page and conditional theme builder powered purely by **GRAB v1.1.0**, **GrabLab CMS v1.0.0**, and **Grex JS v1.0.0** (zero Vue, Pinia, Node, Webpack, or Vite bloat).

It packages and installs as a first-class, exclusive `mode: "visual"` theme inside **GrabLab CMS**. When activated, it disables any prior theme and takes 100% exclusive template rendering control with clean semantic HTML (zero wrapper `<div>` bloat).

---

## Key Architecture Pillars
1. **Exclusive `mode: "visual"` GrabLab Theme:** Ships with `theme/theme.json` (`"mode": "visual"`, `"engine": "grex-visual"`) and zero-`<div>` `.grab.html` template shells — never a third-party plugin.
2. **Pure `Grex JS v1.0.0` Reactive Studio:** Signal-driven state (`createBuilderStore`), 20-element catalog (`grex.elements.json`), `validateElementNode()`, and live `auditAccessibility()` WCAG AA checks.
3. **Deterministic Undo/Redo Command Stack:** Serializable mutation commands (`createCommandStack`) shared safely by human designers and **Groxy AI** (`grab mcp`).
4. **Fluid Grisp / `--read-only` Docker Sync:** Live split-screen edits patch browser memory via origin-checked `GrexPreviewBridge`; **Save Draft** isolates drafts in `use data`; **Publish** invalidates `use cache` and writes compiled CSS strictly to `/static/grex/` for `server.asset` `?v=<hash>`.

---

## Quick Start (`v0.2.0`)

### 1. Run Standalone Visual Studio
```powershell
grab migrate --db-config grab.data.json --allow-db main:migrate migrations/001_studio_schema.grab
grab serve --allow-scripts --db-config grab.data.json --allow-db main:read-write --platform-config grab.platform.json --allow-cache studio:read-write --static public --allow-read . --allow-write public/grex src/studio.grab
```
Open `http://127.0.0.1:8080/studio` to edit templates, global `--grex-*` theme tokens, reusable `.grex-c-*` classes, and responsive breakpoints, then publish compiled CSS to `public/grex/`.

### 2. Install in GrabLab CMS v1.0.0
Package `theme/` (`python scripts/package_release.py --version 0.2.0`) or copy `theme/` to `themes/grex-builder/` and `theme/assets/theme.css` to `public/themes/grex-builder/theme.css`, then activate **Grex Theme Builder** (`grex-builder`) from `/admin/themes`.

### 3. Run Verification Suite
```powershell
node --test tests/*.test.js
python tests/integration_e2e.py
```

---

## Current Status
- **Latest Release:** `v0.2.0` — Global Theme Token Studio (`createTheme`), Bricks-Style Reusable Class Manager (`createClassManager`), Responsive Breakpoints, & Structured Visual Inspector (**Complete**; see [Grex-Builder-v0.2.0-Guide.pdf](docs/releases/pdf/Grex-Builder-v0.2.0-Guide.pdf)).
- **Governance & Roadmap:** See [GREX-BUILDER-EXPERT.md](GREX-BUILDER-EXPERT.md), [AGENTS.md](AGENTS.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

---

## License
MIT License — see [LICENSE](LICENSE).
