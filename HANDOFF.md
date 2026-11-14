# HANDOFF.md — Tandem Ownership & Session State

**Current Owner:** Google Antigravity  
**Active Milestone:** `v0.1` — Specification Review (`specifications/GREX-BUILDER-SPEC-001.md`)  
**Repository:** `urbanspress/grex-builder` (`C:\Development\grex-builder`)

---

## Current Status
- Repository initialized and linked to `https://github.com/urbanspress/grex-builder`.
- Cross-referenced upstream contracts:
  - `GRAB v1.1.0` (`grab mcp`, `server.asset`, `use cache`, `use data`)
  - `Grex JS v1.0.0` (`grex.elements.json`, `signal`/`computed`/`effect`/`batch`, `createTheme`, `createClassManager`, `auditAccessibility`, `validateElementNode`, `createPreviewBridge`)
  - `GrabLab CMS v1.0.0` (`GRABLAB-SPEC-100.md`: `theme.json` `mode: "visual"`, `registerHook`/`applyFilter`, `query_entries`, `/api/media/upload`, `/api/menus`, `/api/mcp`, `--read-only` `/static/grex/` mount)
- Governance (`GREX-BUILDER-EXPERT.md`, `AGENTS.md`), roadmap (`docs/ROADMAP.md`), and `specifications/GREX-BUILDER-SPEC-001.md` drafted.

## Next Pending Task
1. Await project owner approval of `specifications/GREX-BUILDER-SPEC-001.md`.
2. Upon approval, implement **Grex Theme Builder v0.1** (Exclusive `mode: "visual"` theme shell, `createBuilderStore`, 20-element palette, structure tree, deterministic undo/redo command stack, split-screen `GrexPreviewBridge`, and Draft/Publish `/static/grex/` sync).
