# HANDOFF.md — Tandem Ownership & Session State

**Current Owner:** Google Antigravity  
**Active Milestone:** `v0.1.0` Complete (Ready for `v0.2` Planning)  
**Repository:** `urbanspress/grex-builder` (`C:\Development\grex-builder`)

---

## Current Status (`v0.1.0`)
- **`v0.1.0` Implemented & Verified (`100%` pass):**
  - Exclusive `mode: "visual"` GrabLab theme package (`theme/theme.json`, `theme/grex.elements.json`, 9 zero-`<div>` `.grab.html` shells).
  - Pure `Grex JS v1.0.0` signal store (`theme/assets/store.js` — `createBuilderStore`), schema & security/WCAG AA validator (`theme/assets/schema.js`), and deterministic undo/redo command stack (`theme/assets/commands.js` — `createCommandStack`).
  - Accessible split-screen Studio UI (`theme/assets/studio.js`), origin-checked `GrexPreviewBridge` (`theme/assets/preview-bridge.js`, `theme/assets/preview-host.js`), and GRAB v1.1.0 studio server (`src/studio.grab`, `migrations/001_studio_schema.grab`) with isolated Draft storage and cache-invalidating Publish CSS output (`/static/grex/`).
  - Verified with `node --test tests/*.test.js` (6/6 passing) and `python tests/integration_e2e.py` (5/5 E2E gates passing against live `src/studio.grab` and `GrabLab CMS v1.0.0`).
  - Release assets packaged via `scripts/package_release.py` and `docs/releases/generate_release_guides.py` (`docs/releases/pdf/Grex-Builder-v0.1.0-Guide.pdf`).

## Next Pending Task
1. Draft `specifications/GREX-BUILDER-SPEC-002.md` for `v0.2` (Global Theme & Token Studio, Bricks-style reusable CSS Class Manager via `createClassManager()`, and Visual Responsive Breakpoints).
