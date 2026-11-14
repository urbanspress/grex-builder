# Grex Theme Builder Roadmap

**Repositories:** `urbanspress/grex-builder.in.progress` (active development) / `urbanspress/grex-builder.stable` (verified releases)  
**Grex Theme Builder** is the installable `mode: "visual"` GrabLab CMS theme and visual design studio powered purely by **GRAB**, **GrabLab CMS v1.0.0**, and **Grex JS v1.0.0**.

---

## `v0.1` — Visual Theme Shell, Reactive Store & Split-Screen Preview (Complete — `v0.1.0`)
- **Exclusive `mode: "visual"` Theme Package:** Valid GrabLab `theme.json` (`"mode": "visual"`, `"engine": "grex-visual"`) that deactivates any prior theme upon 1-click activation and takes 100% exclusive template rendering control.
- **Reactive `Grex JS` Editor Store (`createBuilderStore`):** Signal-backed document tree, selection state, dirty/draft tracking, and `validateElementNode()` / `auditAccessibility()` live diagnostics (zero Vue/Pinia).
- **20-Element Palette & Structure Tree:** Drag-and-drop / click-to-insert palette from `grex.elements.json` with semantic tag selection (`section`, `header`, `main`, `article`, `aside`, `footer`) and zero wrapper `<div>` bloat.
- **Deterministic Undo/Redo Command Stack:** Serializable command history (`insert`, `move`, `updateProps`, `updateStyles`, `delete`, `replaceTree`) designed for both human designers and **Groxy AI** (`grab mcp`).
- **Split-Screen `GrexPreviewBridge` & Draft/Publish Sync:** Origin-checked live patching in browser memory, **Save Draft** to GrabLab `use data`, and **Publish** with `use cache` invalidation + `/static/grex/` CSS output.

---

## `v0.2` — Bricks-Style Class/Theme Inspector & Responsive Breakpoints (Complete — `v0.2.0`)
- **Global Theme & Design Token Studio:** Visual editor for `--grex-*` colors, typography scales, spacing, radii, shadows, and light/dark modes backed by `createTheme()`.
- **Reusable Class Manager:** Bricks-style reusable CSS classes backed by `createClassManager()` with per-class style editing and cascade preview.
- **Visual Responsive Breakpoints:** Desktop, Tablet, Mobile, and custom breakpoint toggles with per-device style overrides compiled to `/static/grex/tokens.css` and `/static/grex/builder.css`.

---

## `v0.3` — Conditional Theme Builder, Query Loop Builder & Dynamic Data Picker
- **Conditional Global Parts & Templates:** Visual design for `header`, `footer`, `home`, `single`, `archive`, `search`, and `404` templates with display rules (route, content type, taxonomy, or user state).
- **Visual Query Loop Builder:** Point-and-click configuration of GrabLab `query_entries` / `GET /api/query` loops (content type, taxonomy terms, custom fields, sorting, pagination) with `ForEach` rendering.
- **Dynamic Data, Media & Menu Picker:** Visual binding to GrabLab entries, custom fields (`GrabDecimal`-safe), `/api/media/upload` assets (enforcing `alt_text` / `is_decorative`), and `/api/menus` navigation structures.

---

## `v0.4` — Revisions, Rollback & AI Design Guardrails
- **Revision History & One-Click Rollback:** Snapshotted layout revisions stored in GrabLab `use data` with visual diff summary and instant rollback.
- **`GRAB-DESIGN-SYSTEM.md` & `grab mcp` AI Guardrails:** Curated spacing, typography, contrast, and layout rules paired with `/api/mcp` (`update_entry_layout`, `create_entry_draft`) so **Groxy AI** composes validated pages out of native elements.

---

## `v1.0.0` — Production Release
- Full end-to-end verification against **GrabLab CMS v1.0.0** and **GRAB v1.1.0** in hardened `--read-only` Docker containers (`/static/grex/` writable mount + `server.asset` `?v=<hash>`).
- 100% passing automated unit, DOM, WCAG AA accessibility, and integration test suite.
- Plain-English Walkthrough PDF (`docs/releases/pdf/GREX-BUILDER-v1.0.0-Guide.pdf`), checksums, and tagged GitHub Release.
