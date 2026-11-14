# GREX-BUILDER-SPEC-004: Grex Theme Builder `v0.4` — Immutable Revisions, One-Click Rollback & `GRAB-DESIGN-SYSTEM.md` AI Guardrails

**Status:** Specification in Review (Pending Owner Approval — Do NOT Write Application Code Yet)  
**Milestone:** `v0.4` (`v0.4.0`) — Revision History Snapshots, One-Click Rollback & `GRAB-DESIGN-SYSTEM.md` AI Guardrails for `grab mcp`  
**Upstream Baselines:**
- **GRAB:** `v1.1.0` (`grab serve --allow-scripts`, `grab check`, `grab format <file>`, `grab mcp`, `server.asset`, `use cache`, `use data`, `use crypto`)
- **Grex JS:** `v1.0.0` (`createBuilderStore`, `createTheme`, `createClassManager`, `auditAccessibility`, `validateElementNode`, `createPreviewBridge`, `ForEach`)
- **GrabLab CMS:** `v1.0.0` (`GRABLAB-SPEC-100.md` — `mode: "visual"`, `use data` migrations, `use cache` epoch invalidation, `/api/mcp` / `grab mcp` entry & layout tools)

---

## 1. Purpose & `v0.4` Scope

`GREX-BUILDER-SPEC-004` defines **Grex Theme Builder `v0.4.0`**, adding production safety nets for human designers (immutable publish snapshots + 1-click rollback) and strict, inspectable design-system guardrails for **Groxy AI** (`grab mcp` / `/api/mcp`), while upholding all four non-negotiable pillars of [GREX-BUILDER-EXPERT.md](../GREX-BUILDER-EXPERT.md):
- **Exclusive `mode: "visual"` Theme Contract:** Remains a valid GrabLab theme (`theme.json` with `"schemaVersion": "1.0.0"`, `"mode": "visual"`, `"engine": "grex-visual"`).
- **100% `Grex JS v1.0.0` Signals & Zero Wrapper `<div>` Bloat:** All new Studio drawers, diff summaries, and AI-audit badges render semantic HTML5 (`<aside>`, `<section>`, `<dialog>`, `<ul>`, `<li>`, `<button>`) using `Grex JS` signals with zero Vue/Pinia/Webpack bloat.
- **Zero-FOUC CSS-First Atomic Restore:** Restoring any historical revision writes compiled `/static/grex/tokens.css` and `/static/grex/builder.css` **before** updating active templates in `use data` and invalidating `use cache`.
- **Deterministic Command History Parity:** Every AI-generated or AI-boosted layout update routes through `createCommandStack` (`createBuilderStore`) so human designers can inspect, preview, or **Undo** any **Groxy AI** edit in one click.

### Included in `v0.4`
1. **Immutable Template & Layout Revisions + 1-Click Rollback:**
   - Versioned `template_revisions` database migration (`migrations/002_revisions_schema.grab`) capturing every published snapshot (layouts, conditional rules, `--grex-*` tokens, `.grex-c-*` classes, author, timestamp, summary, SHA-256 content hash).
   - Accessible **Revisions & Diff Drawer** in the Studio with live `GrexPreviewBridge` historical preview and atomic 1-click **Restore as New Revision** (append-only history).
2. **`GRAB-DESIGN-SYSTEM.md` & `grab mcp` AI Guardrails for Groxy AI:**
   - Auto-generated, deterministic `GRAB-DESIGN-SYSTEM.md` contract kept in sync on every Publish / Restore.
   - Strict `grab mcp` / `/api/mcp` validation pipeline (`validateElementNode()`, WCAG AA `4.5:1` contrast + `alt` text via `auditAccessibility()`, zero wrapper-`<div>` check, and `createCommandStack` command wrapping).
3. **Acceptance & Verification Gates:**
   - Automated unit, DOM, accessibility, `grab check` / `grab format`, and live Grisp + GrabLab E2E tests.

### Deferred to `v1.0.0`
- Hardened `--read-only` Docker container deployment & `server.asset` `?v=<12-char-sha256>` production verification (`v1.0.0`).
- Full pre-`v1.0.0` security, DOM, and contract audit (`Orchestrator (Argon)`).

---

## 2. Immutable Template & Layout Revisions + One-Click Rollback

### 2.1 `template_revisions` Migration (`migrations/002_revisions_schema.grab`)
A new idempotent GRAB `use data` migration (version `2`, name `"grex_builder_revisions_v04"`) creates an append-only `template_revisions` table:

| Column | Type | Purpose |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY` | Monotonic revision ID (`rev_1`, `rev_2`, …) |
| `revision_number` | `INTEGER NOT NULL` | Sequential 1-based revision number per site/scope |
| `scope_key` | `TEXT NOT NULL` | `"site"` (full-bundle publish snapshot) or template ID |
| `author` | `TEXT NOT NULL` | Authenticated Studio user or `"groxy-ai"` |
| `summary` | `TEXT NOT NULL` | Human-readable change summary (e.g., `"Published Home & tokens"` or `"Restored from Revision #4"`) |
| `content_hash` | `TEXT NOT NULL` | Lowercase 64-char SHA-256 hex digest of canonical snapshot JSON |
| `snapshot_json` | `TEXT NOT NULL` | Canonical JSON bundle: `{ templates, conditional_rules, theme_tokens, class_registry }` |
| `parent_revision_id` | `INTEGER` | Optional reference to source revision when created via rollback |
| `created_at` | `TEXT NOT NULL` | UTC ISO-8601 timestamp |

- **Immutability Invariant:** Rows in `template_revisions` are **append-only**. Application code MUST NEVER `UPDATE` or `DELETE` existing revision rows (enforced by prepared statements exposing only `INSERT` and `SELECT`).
- **Deduplication Guard:** If a Publish produces the exact same `content_hash` as the latest revision for `scope_key`, no duplicate revision row is inserted (or it returns the existing head revision cleanly).

### 2.2 Automatic Publish Snapshotting
Whenever a designer clicks **Publish** (after passing `GREX-TPL-CONFLICT`, `validateElementNode()`, and `auditAccessibility()` checks):
1. Compile `/static/grex/tokens.css` and `/static/grex/builder.css` and write them atomically to `/static/grex/`.
2. Serialize the full published bundle (`templates`, `conditional_rules`, `theme_tokens`, `class_registry`) into canonical JSON and compute its SHA-256 `content_hash` via `use crypto`.
3. Insert a new immutable row into `template_revisions` inside `use data`.
4. Update the active live state in `studio_layouts`, regenerate `GRAB-DESIGN-SYSTEM.md`, and invalidate `use cache` (`studio` + GrabLab page cache).

### 2.3 Accessible Revisions & Diff Drawer
The Studio toolbar adds a **Revisions** button (`aria-expanded`, keyboard-accessible) that opens the **Revisions & Diff Drawer** (`<aside aria-label="Revision History">`):
- **Timeline List:** Displays each revision's `#revision_number`, `summary`, `author`, `created_at`, and truncated `content_hash` (`sha256:abcd1234…`).
- **Structured Diff Summary:** Compares the selected historical revision against the current live revision and shows human-readable counts and items:
  - Added / modified / removed templates & conditional rules
  - Changed `--grex-*` theme tokens (showing old -> new values)
  - Added / modified / removed `.grex-c-*` reusable classes
- **Live Historical Preview (`GrexPreviewBridge`):** Clicking **Preview Revision** pushes the selected revision's snapshot (`templates`, `theme_tokens`, `class_registry`) into `GrexPreviewBridge` (`previewRevision` message, origin-validated) so the designer sees an exact 1:1 visual preview in the iframe **without** modifying live visitor traffic or overwriting their current draft.
- **One-Click Atomic Rollback (`Restore`):** Clicking **Restore This Revision** (with a semantic `<dialog>` confirmation):
  1. Writes the historical revision's compiled `tokens.css` and `builder.css` to `/static/grex/` **first** (zero FOUC).
  2. Updates active `studio_layouts` in `use data`.
  3. Appends a **new forward revision** (`summary: "Restored from Revision #<N>"`, `parent_revision_id: <id>`) to `template_revisions` so no history is ever erased.
  4. Regenerates `GRAB-DESIGN-SYSTEM.md` and invalidates `use cache`.
  5. Syncs the Studio store and `GrexPreviewBridge` to the restored state.

### 2.4 Backend Endpoints (`src/studio.grab`)
- `GET /api/revisions` — Lists revision metadata (`id`, `revision_number`, `author`, `summary`, `content_hash`, `parent_revision_id`, `created_at`), newest first.
- `GET /api/revisions/{id}` — Returns full `snapshot_json` plus structured diff against current live head.
- `POST /api/revisions/{id}/restore` — Performs atomic CSS-first zero-FOUC restore and creates a new forward revision.

---

## 3. `GRAB-DESIGN-SYSTEM.md` & `grab mcp` AI Guardrails for Groxy AI

### 3.1 `GRAB-DESIGN-SYSTEM.md` Contract Generation
**Grex Theme Builder** automatically generates and maintains a structured, deterministic `GRAB-DESIGN-SYSTEM.md` file (served/exported at `storage/GRAB-DESIGN-SYSTEM.md` and `GET /api/design-system.md`) whenever the site's design system or templates are published or restored.

`GRAB-DESIGN-SYSTEM.md` contains four machine- and AI-readable sections:
1. **Active `--grex-*` Design Tokens:** Exact CSS custom property names and values for light/dark color palettes, typography scales, spacing steps, radii, and shadows—plus WCAG AA contrast pair notes.
2. **Reusable `.grex-c-*` Class Registry:** Every author-defined class from `createClassManager()` with its base properties and responsive overrides (`desktop`, `tablet`, `mobile`), instructing **Groxy AI** to reuse existing classes rather than inventing inline styles.
3. **Approved `grex.elements.json` Patterns & Semantic Rules:** The 20 native Grex elements (`Section`, `Container`, `Grid`, `Stack`, `Card`, `Heading`, `Text`, `RichText`, `Link`, `Button`, `Image`, `Icon`, `Form`, `Input`, `Select`, `Tabs`, `Accordion`, `Modal`, `Nav`, `ForEach`), explicit **zero wrapper-`<div>`** rule, max nesting depth (`24`), and allowed semantic tags (`section`, `header`, `nav`, `main`, `article`, `aside`, `footer`, etc.).
4. **Conditional Template Slots & Reusable Parts:** Active slots (`header`, `footer`, `home`, `single`, `archive`, `search`, `404`) and reusable global parts (`card`, `hero`, `cta`) with their IDs and condition summaries.

### 3.2 Strict `grab mcp` / `/api/mcp` AI Mutation Guardrails
When **Groxy AI** (or any MCP client) calls `update_entry_layout` or `create_entry_draft` (via `POST /api/mcp/layout` or `grab mcp` bridge):
1. **Structural & Security Validation (`validateElementNode()`):**
   - Every node in the submitted layout tree MUST pass `validateElementNode()` (and server-side `validate_grex_node`).
   - **Hard Rejections (HTTP `422` / MCP `-32602` Invalid Params):**
     - Any `<div>` tag or non-`grex.elements.json` element type.
     - Any `<script>`, `<iframe>`, `<object>`, `<style>`, inline `on*` attributes, `innerHTML`, or unsafe URLs (`javascript:`, `vbscript:`, `file:`, unsanitized `data:`).
     - Nesting depth exceeding `24` levels.
2. **Accessibility Gate (`auditAccessibility()`):**
   - **WCAG AA Contrast (`4.5:1`):** Text/background token or style pairs below `4.5:1` (or `3:1` for large text) are rejected before the layout can enter the canvas or draft store.
   - **Image `alt` Enforcement (`GREX-A11Y-002`):** Non-decorative `Image` nodes with missing/empty `alt` text are rejected unless explicitly marked decorative (`isDecorative: true`, `alt: ""`, `aria-hidden: "true"`).
   - **Heading Hierarchy & Landmarks:** Skipped heading levels or invalid landmark nesting produce structured `GREX-A11Y-*` diagnostics and fail the strict AI guardrail.
3. **Deterministic Command Stack Routing (`createCommandStack`):**
   - Validated AI layout updates MUST NOT overwrite `studio_layouts` blindly. Instead, they execute as a deterministic `applyAiLayout` / `replaceTree` command in `createBuilderStore` (`actor: "groxy-ai"`) and are logged in `studio_commands` with full `before` and `after` snapshots.
   - Human designers see a non-intrusive badge/toast (*"Updated by Groxy AI"*) and can click **Undo** (or `Ctrl+Z`) in one click to revert the entire AI edit cleanly.

---

## 4. Acceptance & Verification Gates

`v0.4.0` is complete and eligible for `stable` promotion **only** when **100%** of the following gates pass:

1. **GRAB CLI Static & Format Verification:**
   - `grab check` passes with zero errors on all `.grab` and `.grab.html` files (including `migrations/002_revisions_schema.grab` and `src/studio.grab`).
   - `grab format <file>` stdout matches every `.grab` file byte-for-byte.
2. **Unit, Store & Command Parity Tests (`node --test tests/*.test.js`):**
   - `template_revisions` snapshot serialization, canonical SHA-256 hashing, deduplication, and structured diff computation.
   - Deterministic `applyAiLayout` (`actor: "groxy-ai"`) `execute` / `undo` / `redo` round-trips in `createCommandStack`.
   - `GRAB-DESIGN-SYSTEM.md` deterministic generation from `--grex-*` tokens, `.grex-c-*` classes, `grex.elements.json`, and conditional template slots.
   - `grab mcp` / AI guardrail rejection tests: `<div>` injection, `<script>`/`javascript:` XSS payloads, WCAG AA `< 4.5:1` contrast violations, missing `alt` text, and depth `> 24` are all rejected with explicit error codes while leaving store state untouched.
3. **DOM & Accessibility Tests:**
   - Revisions & Diff Drawer renders semantic `<aside>` / `<dialog>` / `<ul>` / `<li>` / `<button>` with **zero wrapper `<div>` elements** and full keyboard accessibility.
   - `auditAccessibility()` passes 100% on the Studio UI and restored/AI-authored trees.
4. **Live Grisp & GrabLab E2E Integration (`tests/integration_e2e.py`):**
   - End-to-end Publish -> `template_revisions` row created -> second Publish -> `GET /api/revisions` & diff verified -> `POST /api/revisions/{id}/restore` verifies **CSS-first `/static/grex/` write order before `use data` / `use cache` update** (zero FOUC) and confirms a new forward revision is appended (original history preserved).
   - End-to-end `GRAB-DESIGN-SYSTEM.md` generation + `POST /api/mcp/layout` rejecting invalid AI layout (`422`) and accepting valid AI layout (`200`) with 1-click Undo parity.
5. **Release Assets (upon `v0.4.0` completion):**
   - Plain-English Walkthrough PDF (`docs/releases/pdf/Grex-Builder-v0.4.0-Guide.pdf`), packaged theme archive, `SHA256SUMS.txt`, and synchronized GitHub Releases on `urbanspress/grex-builder.progress` and `urbanspress/grex-builder.stable`.
