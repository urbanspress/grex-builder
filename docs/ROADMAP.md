# Grex Theme Builder Roadmap

**Repositories:** `urbanspress/grex-builder.progress` (active development) / `urbanspress/grex-builder.stable` (verified releases)  
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

## `v0.3` — Conditional Theme Builder, Query Loop Builder & Dynamic Data Picker (Complete — `v0.3.0`)
**Status:** Complete & verified (`v0.3.0`; [`specifications/GREX-BUILDER-SPEC-003.md`](../specifications/GREX-BUILDER-SPEC-003.md))

- **Conditional Global Parts & Templates:** Visual design for `header`, `footer`, `home`, `single`, `archive`, `search`, and `404` templates plus reusable global parts (`card`, `hero`, `cta`) with deterministic display rules (*Entire Site*, *Front Page*, *All Posts*, *Specific Content Type*, *Specific Taxonomy/Term*, *Specific Entry Slug*, *404 Page*, *Search Results*) and conflict detection.
- **Visual Query Loop Builder:** Point-and-click configuration of GrabLab `query_entries` / `GET /api/query` loops (`content_type`, `filter_by_term`, custom fields, sorting, pagination) bound to `Grid`, `Stack`, or `Section` containers with `Grex JS v1.0.0` `ForEach` rendering and zero wrapper-`<div>` bloat.
- **Dynamic Data, Media & Menu Picker:** Visual binding to GrabLab entries (`entry.title`, `entry.slug`, `entry.published_at`, `entry.custom_fields.<key>`, `term.name`, `site.title` with `GrabDecimal`/`GrabInteger` precision), `/api/media` assets (enforcing `alt_text` / `is_decorative`), and `/api/menus` (`primary`, `footer`, `mobile`) navigation structures.

---

## `v0.4` — Revisions, Rollback & AI Design Guardrails
**Status:** Complete & verified (`v0.4.0`; [`specifications/GREX-BUILDER-SPEC-004.md`](../specifications/GREX-BUILDER-SPEC-004.md))

- **Revision History & One-Click Rollback:** Immutable snapshotted layout, conditional rule, token, and class-registry revisions (`template_revisions`) stored in GrabLab `use data` with SHA-256 content hashing, visual diff summary, `GrexPreviewBridge` historical preview, and atomic one-click rollback (creating a new forward revision) with CSS-first zero-FOUC `/static/grex/` republishing.
- **`GRAB-DESIGN-SYSTEM.md` & `grab mcp` AI Guardrails:** Auto-generated, machine- and AI-readable design-system contract describing active `--grex-*` tokens, `.grex-c-*` reusable classes, approved `grex.elements.json` patterns, and conditional template slots, paired with strict `grab mcp` / `/api/mcp` mutation guardrails (`validateElementNode()`, WCAG AA `4.5:1` contrast + `alt` `auditAccessibility()`, zero wrapper-`<div>` enforcement, and `createCommandStack` undo parity for **Groxy AI**).

---

## `v1.0.0` — Production Theme Builder Release (`Approved target; specification in review`)
**Status:** `Approved target; specification in review` ([`specifications/GREX-BUILDER-SPEC-100.md`](../specifications/GREX-BUILDER-SPEC-100.md))  
Pre-`v1.0.0` security, semantic zero-`<div>` DOM, CSS-first zero-FOUC, asset byte-parity, and `--read-only` Docker isolation audit complete (`24/24` Node tests + `5/5` live GRAB/GrabLab E2E gates passing).

- Production freeze of `theme.json` (`mode: "visual"`), `grex.elements.json` (20 elements), `createBuilderStore`, 17-command `createCommandStack`, origin-checked `GrexPreviewBridge` v1.0, `template_revisions` + zero-FOUC CSS-first Publish/Restore, `GRAB-DESIGN-SYSTEM.md` + `POST /api/mcp/layout` AI guardrails, and hardened `--read-only` Docker templates (`deploy/docker-compose.yml` + `deploy/README.md`).
- Final `v1.0.0` promotion gate (pending owner approval of `GREX-BUILDER-SPEC-100.md`): Plain-English Walkthrough PDF, packaged theme archive + checksums, and synchronized GitHub Releases on `urbanspress/grex-builder.progress` and `urbanspress/grex-builder.stable`.
