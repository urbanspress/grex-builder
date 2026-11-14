# Changelog — Grex Theme Builder

All notable milestones and verified releases for **Grex Theme Builder** (Step 3 of the Post-1.0 **GRAB Ecosystem**).

---

## `v1.0.0` — Production Visual Theme & Studio Release (2026-11-14)
**Status:** Approved & Frozen — Complete (`specifications/GREX-BUILDER-SPEC-100.md`)

### Production Freeze & Multi-Layer Hardening
- **Version & Contract Freeze:** Froze `"version": "1.0.0"`, `mode: "visual"`, `engine: "grex-visual"`, the 20-element `grex.elements.json` catalog, `createBuilderStore`, 17-command `createCommandStack`, origin-checked `GrexPreviewBridge` v1.0, `template_revisions` + zero-FOUC CSS-first Publish/Restore, `GRAB-DESIGN-SYSTEM.md`, and `POST /api/mcp/layout` AI guardrails.
- **Readiness & Security Hardening (`src/studio.grab`, `views/studio.grab.html`):**
  - Added `GET /_ready` readiness probe alongside `GET /_health` reporting `"version": "1.0.0"`.
  - Enforced server-side `attrs` and `styles` (`base`, `tablet`, `mobile`) security checks (`GREX-SEC-004` / `GREX-SEC-003`) and `audit_grex_doc_a11y` WCAG AA checks on `POST /api/studio/publish` and `POST /api/mcp/layout` (across templates and parts).
  - Linked immutable `/static/theme/builder.css` independently from compiled `{builder_css_url}` (`/static/grex/builder.css`) and recorded `<meta name="grex-version" content="1.0.0">` in `views/studio.grab.html`.
- **Conditional Rule Normalization (`theme/assets/templates.js`):** Normalized string-shorthand `taxonomy_term` conditional rules in `normalizeTemplateConditions`.
- **Hardened `--read-only` Docker Deployment (`deploy/docker-compose.yml`, `deploy/README.md`):** Added production `--read-only` container templates (`cap_drop: ["ALL"]`, `no-new-privileges:true`, writable mounts strictly scoped to `storage/`, `uploads/`, and `public/grex/`).
- **Verification & Release Assets:** Verified **24/24** Node unit/DOM/accessibility/audit tests and **5/5** live GRAB/GrabLab CMS v1.0.0 E2E gates (including canonical `grab check`, non-destructive `grab format`, and zero wrapper-`<div>` across all 11 `.grab.html` files); generated `Grex-Builder-v1.0.0-Guide.pdf`, `grex-builder-v1.0.0-theme.zip`, and `SHA256SUMS.txt`.

---

## `v0.4.0` — Revisions, Rollback & `GRAB-DESIGN-SYSTEM.md` / `grab mcp` AI Guardrails (2026-11-14)
- **Immutable Publish Snapshots:** Added `migrations/002_revisions_schema.grab` (`template_revisions`) with canonical SHA-256 deduplication in `revisions.js` and `src/studio.grab`.
- **Semantic Revisions & Diff Drawer:** Added zero-wrapper-`<div>` **Revisions** drawer in `studio.js` with structured diffs, isolated historical live preview via `GrexPreviewBridge` (`previewRevision`), and one-click zero-FOUC CSS-first rollback (`POST /api/revisions/{id}/restore`) appending forward audit revisions.
- **Auto-Generated `GRAB-DESIGN-SYSTEM.md` & `grab mcp` AI Guardrails:** Added `design-system.js` (`GET /api/design-system.md`), `POST /api/mcp/layout` validation (`validateElementNode()` + WCAG AA `auditAccessibility()`), and undoable `applyAiLayout` command (`actor: "groxy-ai"`).
- **Verification:** **20/20** Node tests + **5/5** E2E gates passing (`Grex-Builder-v0.4.0-Guide.pdf`).

---

## `v0.3.0` — Conditional Theme Builder, Query Loop Builder & Pickers (2026-11-14)
- **Conditional Theme Builder & Conflict Gate (`GREX-TPL-CONFLICT`):** Visual template assignment across `header`, `footer`, `home`, `single`, `archive`, `search`, `404`, and reusable parts with deterministic specificity resolution (`entry_slug > taxonomy_term > content_type > all_posts / front_page > entire_site`), `exclude` rules, and Publish conflict blocking.
- **Visual Query Loop Builder (`ForEach`):** Configured GrabLab `query_entries` / `GET /api/query` feeds with zero wrapper-`<div>` output.
- **Dynamic Data, Media & Menu Pickers + Preview Context Selector:** Added exact `GrabDecimal`/`GrabInteger` dynamic bindings, accessible Media Library modal (`GREX-A11Y-002`, `/api/media`), Navigation Menu picker (`/api/menus/{location}`), toolbar **Preview As** selector, and 6 reversible undo/redo commands.
- **Verification:** **15/15** Node tests + **5/5** E2E gates passing (`Grex-Builder-v0.3.0-Guide.pdf`).

---

## `v0.2.0` — Design Token Studio, Reusable Class Manager & Responsive Breakpoints (2026-11-14)
- **Global Theme & Design Token Studio:** Visual editor for `--grex-*` tokens and Light/Dark modes via `createTheme()`, with live WCAG AA contrast warnings (`GREX-A11Y-001`).
- **Bricks-Style Reusable Class Manager:** `.grex-c-*` reusable class creation, renaming, duplication, deletion, and assignment via `createClassManager()`.
- **Responsive Breakpoint Switcher & CSS-First Publish:** Desktop (`>= 1025px`), Tablet (`<= 1024px`), and Mobile (`<= 767px`) breakpoint overrides compiled atomically to `/static/grex/tokens.css` and `/static/grex/builder.css` before `use cache` invalidation.
- **Verification:** **10/10** Node tests + **5/5** E2E gates passing (`Grex-Builder-v0.2.0-Guide.pdf`).

---

## `v0.1.0` — Visual Theme Shell, Reactive Store & Split-Screen Preview (2026-11-14)
- **Exclusive `mode: "visual"` GrabLab Theme Package:** `theme/theme.json` (`"mode": "visual"`, `"engine": "grex-visual"`) with 20 native semantic elements (`theme/grex.elements.json`) and zero wrapper-`<div>` `.grab.html` templates.
- **Pure `Grex JS v1.0.0` Studio & Command Stack:** `createBuilderStore`, deterministic undo/redo `createCommandStack`, origin-checked `GrexPreviewBridge`, and GrabLab Draft/Publish isolation (`migrations/001_studio_schema.grab`, `src/studio.grab`).
- **Verification:** **5/5** E2E gates passing (`Grex-Builder-v0.1.0-Guide.pdf`).
