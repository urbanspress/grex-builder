# Grex Theme Builder (`grex-builder`)

**Grex Theme Builder** is Step 3 of the Post-1.0 **GRAB Ecosystem** — a responsive-first visual page and conditional theme builder powered purely by **GRAB v1.1.0**, **GrabLab CMS v1.0.0**, and **Grex JS v1.0.0** (zero Vue, Pinia, Node, Webpack, or Vite bloat).

It packages and installs as a first-class, exclusive `mode: "visual"` theme inside **GrabLab CMS**. When activated, it disables any prior theme and takes 100% exclusive template rendering control with clean semantic HTML (zero wrapper `<div>` bloat).

---

## Key Architecture Pillars
1. **Exclusive `mode: "visual"` GrabLab Theme:** Ships with `theme.json` (`"mode": "visual"`, `"engine": "grex-visual"`) — never a third-party plugin.
2. **Pure `Grex JS v1.0.0` Reactive Studio:** Signal-driven state (`createBuilderStore`), 20-element catalog (`grex.elements.json`), `validateElementNode()`, and live `auditAccessibility()` WCAG AA checks.
3. **Deterministic Undo/Redo Command Stack:** Serializable mutation commands shared safely by human designers and **Groxy AI** (`grab mcp`).
4. **Fluid Grisp / `--read-only` Docker Sync:** Live split-screen edits patch browser memory via origin-checked `GrexPreviewBridge`; **Save Draft** isolates drafts in GrabLab `use data`; **Publish** invalidates `use cache` and writes compiled CSS strictly to `/static/grex/` for `server.asset` `?v=<hash>`.

---

## Current Status
- **Active Milestone:** `v0.1` — Specification Review (`specifications/GREX-BUILDER-SPEC-001.md` drafted for approval).
- **Governance & Roadmap:** See [GREX-BUILDER-EXPERT.md](GREX-BUILDER-EXPERT.md), [AGENTS.md](AGENTS.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

---

## License
MIT License — see [LICENSE](LICENSE).
