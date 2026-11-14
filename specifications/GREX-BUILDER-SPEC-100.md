# GREX-BUILDER-SPEC-100: Grex Theme Builder `v1.0.0` Production Freeze & Hardening Specification

- **Status:** Draft — Awaiting Project Owner Approval
- **Target Milestone:** `v1.0.0`
- **Dependencies:**
  - **GRAB:** `v1.1.0` (`use data`, `use cache`, `use server`, `server.asset`, `grab check`, `grab format`, `grab migrate`)
  - **GrabLab CMS:** `v1.0.0` (`mode: "visual"`, `engine: "grex-visual"`, exclusive theme activation, `/api/query`, `/api/media`, `/api/menus`, `grab mcp`)
  - **Grex JS:** `v1.0.0` (`signal`, `computed`, `effect`, `batch`, `untrack`, `createTheme`, `createClassManager`, `compileTokenCss`, `compileElementStyles`, `renderNode`, `ForEach`, `createPreviewBridge`, `validateElementNode`, `auditAccessibility`, `PREVIEW_CHANNEL`)
- **Governance:** Read alongside [`AGENTS.md`](../AGENTS.md) and [`GREX-BUILDER-EXPERT.md`](../GREX-BUILDER-EXPERT.md). Zero Vue, Pinia, Node runtime dependencies, Webpack, or Vite.

---

## 1. Purpose & Production Freeze Scope

**Grex Theme Builder** (`v1.0.0`) freezes Step 3 of the Post-1.0 GRAB Ecosystem as a production-hardened, zero-build, responsive-first visual page and conditional theme builder for **GrabLab CMS `v1.0.0`**.

Following the `v0.1.0` Studio Shell, `v0.2.0` Design System & Breakpoints, `v0.3.0` Conditional Theme & Dynamic Query Engine, and `v0.4.0` Revisions & AI Design Guardrails milestones, this specification records the findings of the pre-`v1.0.0` second-opinion audit and freezes all `v1.x` public contracts across:

1. Theme manifest (`theme/theme.json`) and 20-element catalog (`theme/grex.elements.json`).
2. Reactive Studio store (`createBuilderStore`) and deterministic 17-command undo/redo stack (`createCommandStack`).
3. Origin-checked 1:1 canvas bridge (`GrexPreviewBridge` v1.0).
4. Immutable revision snapshots (`template_revisions`), zero-FOUC CSS-first Publish/Restore write ordering, and live `GRAB-DESIGN-SYSTEM.md` + `POST /api/mcp/layout` AI guardrails.
5. Hardened `--read-only` Docker deployment manifests (`deploy/docker-compose.yml` & `deploy/README.md`).

---

## 2. Pre-`v1.0.0` Multi-Layer Security & Invariant Audit Summary

All four audit pillars were independently verified across `C:\Development\grex-builder` and cross-checked against upstream `GRAB v1.1.0`, `Grex JS v1.0.0`, and `GrabLab CMS v1.0.0` contracts (without modifying upstream source repositories):

| Audit Pillar | Scope Verified | Hardening Improvements Applied During Audit | Verification Status |
|---|---|---|---|
| **1. Zero Wrapper-`<div>` & Semantic DOM** | All 11 `.grab.html` files (`views/*.grab.html`, `theme/templates/*.grab.html`, `theme/templates/parts/*.grab.html`), Studio panels, Media Library modal (`#grex-media-dialog`), Navigation Menu picker (`#grex-nav-menu-picker`), Revisions Drawer (`#grex-revisions-drawer`), and Restore Dialog (`#grex-restore-dialog`). | Added `tests/unit_v100_production_audit.test.js` exercising Media modal, Nav Menu picker, Tokens/Templates tabs, Revisions Drawer, and Restore Dialog with assertions for `div` count `=== 0` and `innerHTMLWriteCount === 0`. | **100% Pass** (0 `<div>` tags, 0 `innerHTML` writes, 0 unsafe `eval`/`javascript:`/`data:` URLs). |
| **2. 1:1 Canvas Parity & Zero-FOUC Publish/Restore** | `theme/assets/preview-bridge.js` (`renderNode`, `createTheme`, `createClassManager`, `compileElementStyles`) and `src/studio.grab` Publish + Restore handlers. | Linked immutable `/static/theme/builder.css` in `views/studio.grab.html` independently from compiled `{builder_css_url}` (`/static/grex/builder.css`) so Studio chrome stays styled after site CSS compilation; enforced server-side `audit_grex_doc_a11y` on `POST /api/studio/publish` and `POST /api/mcp/layout` (templates & parts). | **100% Pass** (CSS files written first; `use data`, `GRAB-DESIGN-SYSTEM.md`, and `use cache` epoch invalidation follow). |
| **3. Exclusive `mode: "visual"` & `--read-only` Isolation** | `theme/theme.json`, `theme/grex.elements.json`, `migrations/001`–`002`, CSRF enforcement, `GrexPreviewBridge` origin allowlists, and `POST /api/mcp/layout`. | Added server-side `attrs` & `styles` security validation (`validate_attr_map` + `base`/`tablet`/`mobile` CSS expression checks returning `GREX-SEC-004`/`GREX-SEC-003`) to `src/studio.grab`; added `GET /_ready`; normalized string-shorthand `taxonomy_term` rules in `normalizeTemplateConditions`; authored `deploy/docker-compose.yml` & `deploy/README.md` (`read_only: true`, `cap_drop: ALL`, `no-new-privileges:true`, writable mounts strictly `storage/`, `uploads/`, `public/grex/`). | **100% Pass** (All live Studio & GrabLab CMS v1.0.0 E2E gates pass). |
| **4. Asset Sync & GRAB Canonical Formatting** | `theme/assets/*` vs `public/theme/*` (13 files) and all `.grab` / `.grab.html` files. | Synced updated `templates.js` to `public/theme/templates.js`; converted `tests/integration_e2e.py` `test_grab_static_checks()` to verify `grab format` stdout non-destructively instead of rewriting files during verification. | **100% Pass** (13/13 SHA-256 byte-identical; `grab check` + canonical `grab format` clean). |

---

## 3. Frozen `v1.x` Public Contracts

Any breaking change to the contracts below after `v1.0.0` requires a `v2.0.0` major release. Additive, backward-compatible extensions (new optional tokens, non-breaking fields, or additional starter patterns) are permitted in `v1.x`.

### 3.1 Theme Manifest & 20-Element Registry (`theme/theme.json`, `theme/grex.elements.json`)
- **Theme Identity:** `"slug": "grex-builder"`, `"name": "Grex Theme Builder"`, `"schemaVersion": "1.0.0"`, `"mode": "visual"`, `"engine": "grex-visual"`, `"grexJsVersion": "1.0.0"`.
- **Required Template & Part Slots:**
  - `templates`: `home`, `single`, `archive`, `search`, `404` (`REQUIRED_SLOTS`: `home`, `single`, `archive`, `404`).
  - `parts`: `header`, `footer`, `card`, `sidebar`.
- **20 Frozen Element Types (`grex.elements.json` / `schema.js`):**
  - *Layout:* `Section`, `Container`, `Grid`, `Stack`, `Card`
  - *Typography & Content:* `Heading`, `Text`, `RichText`, `Link`, `Button`
  - *Media & Forms:* `Image`, `Icon`, `Form`, `Input`, `Select`
  - *Interactive & Navigation:* `Tabs`, `Accordion`, `Modal`, `Nav`, `ForEach`
- **Hard Bans:** Tag `div`, raw `<script>`, `<iframe>`, `<object>`, `<style>`, `on*` event attributes, `innerHTML` / `outerHTML` / `dangerouslySetInnerHTML` / `srcdoc`, `javascript:` / `vbscript:` / `file:` / unsanitized `data:` URLs, CSS `expression(...)` / `javascript:`, and nesting depth `> 24` are strictly rejected on both client and server (`GREX-SCHEMA-001`, `GREX-SEC-003`, `GREX-SEC-004`).

### 3.2 Reactive Studio Store (`createBuilderStore`) & Command Stack (`createCommandStack`)
- **Reactive Store (`theme/assets/store.js`):**
  - *Signals:* `activeSlot`, `documentTree`, `themeConfig`, `activeThemeMode`, `classRegistry`, `templateRegistry`, `previewContext`, `activeClassName`, `activeBreakpoint`, `selectedNodeId`, `history`, `isDirty`, `hasUnpublishedChanges`, `saveStatus`, `lastError`, `lastSavedAt`, `lastPublishedAt`, `revisions`, `activeRevisionPreview`, `lastAiActorNotice`.
  - *Computed:* `activeSlotTree`, `selectedNode`, `canUndo`, `canRedo`, `validationReport`, `fullDocumentDiagnostics`, `templateConflicts`, `resolvedActiveTemplate`, `contrastWarnings`, `compiledCss`, `designSystemMarkdown`.
  - *Actions:* `selectSlot`, `selectNode`, `setBreakpoint`, `setThemeMode`, `setActiveClass`, `setPreviewContext`, `dispatch`, `undo`, `redo`, `insertElement`, `deleteElement`, `moveElement`, `updateNodeProps`, `updateNodeStyles`, `updateNodeTag`, `setThemeToken`, `createClass`, `renameClass`, `duplicateClass`, `deleteClass`, `assignClass`, `setBreakpointStyle`, `setTemplateConditions`, `createTemplate`, `deleteTemplate`, `configureQueryLoop`, `bindDynamicField`, `bindMediaAsset`, `bindNavigationMenu`, `replaceSlotTree`, `applyAiLayout`, `applyRestoredDocument`, `computeDiffAgainstCurrent`, `loadRevisions`, `inspectRevision`, `previewRevision`, `clearRevisionPreview`, `restoreRevision`, `exportDocument`, `saveDraft`, `publish`, `slotNames`.
- **17 Frozen Command Types (`theme/assets/commands.js` `COMMAND_TYPES`):**
  - `insertNode`, `deleteNode`, `moveNode`, `updateProps`, `updateStyles`, `replaceTree`, `setThemeToken`, `upsertClass`, `assignClass`, `setBreakpointStyle`, `setTemplateConditions`, `upsertTemplate`, `configureQueryLoop`, `bindDynamicField`, `bindMediaAsset`, `bindNavigationMenu`, `applyAiLayout`.
  - Default undo history capacity: `DEFAULT_MAX_HISTORY = 200`. Every command MUST produce a deterministic inverse for lossless 1-click Undo/Redo.
- **Accessibility Gate (`GREX-A11Y-*` & `GREX-TPL-CONFLICT`):**
  - WCAG AA contrast ratio `>= 4.5:1` (`GREX-A11Y-001`), Image `alt` / explicit decorative flag (`GREX-A11Y-002`), labeled `Input` / `Select` (`GREX-A11Y-003`), non-skipped heading hierarchy (`GREX-A11Y-004`), focus outline & accessible Button/Link labels (`GREX-A11Y-005`), and conditional template conflict checks (`GREX-TPL-CONFLICT`) block **Publish** and **AI MCP** commits with HTTP `422`.

### 3.3 Origin-Checked `GrexPreviewBridge` Protocol (`theme/assets/preview-bridge.js`)
- **Channel:** `PREVIEW_CHANNEL` (`"grex-preview-v1"`). Wildcard `"*"` or empty origin strings MUST throw `GrexSecurityError` fail-closed.
- **Frozen Message Types:**
  - Fine-grained DOM patches: `patch-text`, `patch-attr`, `patch-style`, `patch-token`
  - Signal syncs: `patch-signal` (`key`: `"treeSync"`, `"selectedId"`, `"styleSync"`, `"contextSync"`)
  - Isolated revision preview: `previewRevision` (`slot`, `snapshot`, `themeMode`)

### 3.4 Storage Schema, Zero-FOUC Atomic Order & Revision API (`migrations/001`–`002`, `src/studio.grab`)
- **SQLite / SQL Migrations:**
  - `migrations/001_studio_schema.grab`: `studio_layouts(slot_scope, status, document_json, css_hash, updated_at)` + `studio_commands(id, actor, command_json, created_at)` (`version: 1`).
  - `migrations/002_revisions_schema.grab`: cumulative migration `[version: 1, version: 2]` adding `template_revisions(id, revision_number, scope_key, author, summary, content_hash, snapshot_json, parent_revision_id, created_at)` + indexes `idx_template_revisions_scope` & `idx_template_revisions_hash` (`version: 2`).
- **Frozen Studio & Revision Endpoints:**
  - `GET /_health`, `GET /_ready`, `GET /studio`, `GET /preview/{slot}`, `GET /api/studio/state`, `POST /api/studio/draft`, `POST /api/studio/publish`, `GET /api/revisions`, `GET /api/revisions/{id}`, `POST /api/revisions/{id}/restore`, `GET /api/studio/commands`, `GET /api/design-system.md`, `POST /api/mcp/layout`, `GET /api/query`, `GET /api/media`, `GET /api/menus`, `GET /api/menus/{location}`, `GET /api/preview/context`.
  - All `POST` endpoints MUST verify `X-CSRF-Token` (`403` on missing/invalid token).
- **Mandatory Zero-FOUC Write Sequence (Publish & Restore):**
  1. Validate schema & security invariants (`validate_grex_doc` / `validate_grex_node`) + WCAG AA (`audit_grex_doc_a11y`).
  2. Write compiled `/static/grex/tokens.css` and `/static/grex/builder.css` **first**.
  3. Update active `draft` + `published` rows in `use data` and append deduplicated or forward `template_revisions` snapshot.
  4. Regenerate `GRAB-DESIGN-SYSTEM.md` and bump `live_epoch` in `use cache`.

### 3.5 AI Design System & MCP Guardrail Contract (`design-system.js`, `POST /api/mcp/layout`)
- Every Publish and Restore deterministically generates `storage/GRAB-DESIGN-SYSTEM.md` (served at `GET /api/design-system.md`), documenting active `--grex-*` tokens, Light/Dark overrides, `.grex-c-*` utility classes, conditional slots, and layout invariants.
- `POST /api/mcp/layout` supports both full `document` updates and single `slot` (`templates.*` or `part:*`) updates with `layout` / `nextTree` / `tree` payloads, enforces schema, security, and WCAG AA validation (returning HTTP `422` with `mcp_error.code: -32602`), records `actor: "groxy-ai"` (or caller actor) and undoable `applyAiLayout` command in `studio_commands`, and leaves published live pages untouched until explicit human Publish.

### 3.6 Hardened `--read-only` Docker Deployment Contract (`deploy/docker-compose.yml`, `deploy/README.md`)
- Container root filesystems MUST run with `read_only: true`, `cap_drop: ["ALL"]`, `no-new-privileges:true`, and `tmpfs: /tmp:rw,noexec,nosuid`.
- **Standalone Studio (`grex-builder-studio`):** Writable mounts strictly scoped to `../storage:/app/storage:rw` and `../public/grex:/app/public/grex:rw`.
- **GrabLab Integrated (`grablab-cms` profile `grablab-integrated`):** Mounts `../theme:/app/themes/grex-builder:ro` and `../public/theme:/app/public/themes/grex-builder:ro` read-only; writable mounts strictly scoped to `./grablab-storage:/app/storage:rw`, `./grablab-uploads:/app/uploads:rw`, and `../public/grex:/app/public/grex:rw`.
- Health & readiness probes: `GET /_health` and `GET /_ready` returning `200 OK`.

---

## 4. `v1.0.0` Final Release Packaging & Dual-Repo Promotion Checklist

Once the project owner approves `specifications/GREX-BUILDER-SPEC-100.md`:
1. Bump version metadata from `0.4.0` to `1.0.0` in `theme/theme.json`, `src/studio.grab` (`/_health`, `/_ready`, `generate_design_system_md`), `README.md`, `docs/ROADMAP.md`, and `HANDOFF.md`, and format `src/studio.grab` cleanly.
2. Verify all Node unit/DOM/audit tests (`tests/*.test.js`), all 5 Python E2E verification gates (`python tests/integration_e2e.py`), `grab check`, and read-only `grab format` pass 100%.
3. Generate the plain-English walkthrough PDF (`docs/releases/pdf/Grex-Builder-v1.0.0-Guide.pdf` and matching canonical artifact), package `dist/grex-builder-v1.0.0-theme.zip` + `dist/SHA256SUMS.txt` via `python scripts/package_release.py --version 1.0.0`.
4. Commit, tag `v1.0.0`, push `main` and annotated tags in ascending order to **both** `origin` (`https://github.com/urbanspress/grex-builder.progress.git`) and `stable` (`https://github.com/urbanspress/grex-builder.stable.git`), and publish matching GitHub Releases + assets on **both** repositories.
