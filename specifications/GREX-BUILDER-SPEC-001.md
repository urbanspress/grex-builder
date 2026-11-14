# GREX-BUILDER-SPEC-001: Grex Theme Builder `v0.1` Architecture & Core Contracts

**Status:** Drafted for Project Owner Approval (No Application Code Written)  
**Milestone:** `v0.1` — Exclusive Visual Theme Shell, Reactive Store, Command Stack & Split-Screen Preview  
**Upstream Baselines:**
- **GRAB:** `v1.1.0` (`grab serve`, `grab check`, `grab format`, `grab mcp`, `server.asset`, `use cache`, `use data`)
- **Grex JS:** `v1.0.0` (`grex.elements.json`, `signals.js`, `elements.js`, `interactive.js`, `catalog.js`, `a11y.js`, `tokens.js`, `theme.js`, `bridge.js`, `security.js`)
- **GrabLab CMS:** `v1.0.0` (`GRABLAB-SPEC-100.md` — `theme.json` `mode: "visual"`, `registerHook`/`applyFilter`, `query_entries`, `/api/mcp`, `--read-only` `/static/grex/`)

---

## 1. Purpose & `v0.1` Scope

`GREX-BUILDER-SPEC-001` defines the `v0.1` foundation of **Grex Theme Builder** (`grex-builder`), a responsive-first visual design studio packaged as an installable **GrabLab CMS `mode: "visual"` theme**.

### Included in `v0.1`
1. **Exclusive `mode: "visual"` Theme Package:** Valid GrabLab `theme.json` manifest, default `grex.elements.json` slot definitions (`home`, `single`, `archive`, `404`, `search`, `parts`), and static studio assets.
2. **Pure `Grex JS v1.0.0` Reactive Store (`createBuilderStore`):** Signal-backed document tree, active slot selector, selected node ID, dirty/draft state, and live `validateElementNode()` + `auditAccessibility()` diagnostics (zero Vue, Pinia, Node, Webpack, or Vite).
3. **20-Element Palette & Structure Tree:** Drag-and-drop / click-to-insert element palette generated directly from `grex-js`'s `exportElementCatalog()` (`grex.elements.json`) plus a collapsible semantic Structure Tree (zero wrapper `<div>` bloat).
4. **Deterministic Undo/Redo Command Stack:** Reversible, serializable mutation commands (`insertNode`, `moveNode`, `updateProps`, `updateStyles`, `deleteNode`, `replaceTree`) shared by human designers and **Groxy AI** (`grab mcp`).
5. **Split-Screen Live Preview (`GrexPreviewBridge`):** Origin-checked `postMessage` patching (`PREVIEW_CHANNEL = "grex-preview-v1"`) in browser memory with zero Grisp worker restarts.
6. **Draft / Publish & `/static/grex/` Sync:** **Save Draft** persists draft layout JSON to GrabLab without altering live visitor pages; **Publish** validates the tree, promotes live JSON, invalidates GrabLab `use cache`, and writes compiled CSS to `/static/grex/` for `--read-only` Docker + `server.asset` `?v=<hash>`.

### Deferred to Later Milestones
- Bricks-style class manager & responsive breakpoint toggles (`v0.2`)
- Conditional theme display rules, visual query loop builder & dynamic data/media/menu pickers (`v0.3`)
- Revision history, one-click rollback & `GRAB-DESIGN-SYSTEM.md` AI guardrails (`v0.4`)

---

## 2. Exclusive `mode: "visual"` GrabLab Theme Package

Per `GRABLAB-SPEC-100` Section 3, `grex-builder` ships as a theme directory `themes/grex-builder/` (never a plugin):

```text
themes/grex-builder/
├── theme.json              # Exclusive visual theme manifest
├── grex.elements.json      # Validated default slot trees (home, single, archive, 404, search, parts)
└── assets/
    ├── builder.css         # Studio UI styles (semantic CSS, zero wrapper div assumptions)
    ├── studio.js           # Grex JS v1.0.0 studio entrypoint (ES module)
    ├── store.js            # createBuilderStore + deterministic command stack
    └── preview-host.js     # GrexPreviewBridge receiver for split-screen preview iframe
```

### 2.1 `theme.json` Contract
```json
{
  "schemaVersion": "1.0.0",
  "slug": "grex-builder",
  "name": "Grex Theme Builder",
  "version": "0.1.0",
  "mode": "visual",
  "engine": "grex-visual",
  "capabilities": [
    "templates",
    "parts",
    "hooks:theme",
    "grex:visual",
    "assets:static"
  ],
  "grexElements": "grex.elements.json",
  "themeHooks": {
    "theme:head_meta": "theme_meta_brand",
    "theme:before_render": "theme_before_render_badge"
  }
}
```

### 2.2 Activation & Security Boundaries (`GRAB-E401`)
- Activating `grex-builder` via GrabLab `/admin/themes` (`POST /api/themes/activate`) automatically deactivates the prior active theme (`coded` or `visual`), updates `site_settings`, and invalidates all GrabLab `use cache` query/render epochs.
- All files stay strictly within GrabLab limits: depth `<= 8`, files `<= 250`, single file `<= 5 MB`, total size `<= 25 MB`, and only allowlisted extensions (`.json`, `.css`, `.js` in `assets/`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.woff2`).
- Every node in `grex.elements.json` and any saved/published layout rejects `<div>`, `<script>`, `<iframe>`, `<object>`, `<style>`, inline `on*` attributes, `innerHTML`, unsafe URLs (`javascript:`, unsanitized `data:`), and nesting deeper than `24` levels.

---

## 3. Reactive Editor Store (`createBuilderStore`)

`createBuilderStore(initialDoc, options)` is built exclusively on `Grex JS v1.0.0` signals (`signal`, `computed`, `effect`, `batch`, `untrack`):

### 3.1 Core Signals & Computed State
| State Member | Type | Description |
|---|---|---|
| `activeSlot` | `signal<string>` | Active template slot (`"home"`, `"single"`, `"archive"`, `"404"`, `"search"`, or `"part:<name>"`). |
| `documentTree` | `signal<Record<string, GrexNode>>` | Normalized per-slot root node trees (`Section`, `Container`, `Grid`, `Stack`, etc.). |
| `selectedNodeId` | `signal<string \| null>` | Currently selected node ID in the Structure Tree / Canvas. |
| `history` | `signal<{ undoStack: Command[], redoStack: Command[] }>` | Bounded deterministic command history (default max `200` steps). |
| `isDirty` | `signal<boolean>` | `true` when local edits differ from the last saved draft. |
| `saveStatus` | `signal<"idle" \| "saving" \| "publishing" \| "saved" \| "published" \| "error">` | Current persistence state. |
| `validationReport` | `computed<ValidationSummary>` | Runs `validateElementNode()` + `auditAccessibility()` on the active slot tree whenever `documentTree` changes. |
| `canUndo` / `canRedo` | `computed<boolean>` | Derived from `history()`. |
| `selectedNode` | `computed<GrexNode \| null>` | Resolves `selectedNodeId()` from the active slot tree. |

---

## 4. Deterministic Undo/Redo Command Stack

Every canvas mutation—whether triggered by a human designer clicking/dragging in the UI or by **Groxy AI** via `grab mcp`—is dispatched through `store.dispatch(command)` inside a `Grex JS` `batch(...)`:

### 4.1 `v0.1` Command Primitives
| Command Type | Payload | Inverse (`undo`) |
|---|---|---|
| `insertNode` | `{ slot, parentId, index, node }` | Removes `node.id` from `parentId`. |
| `deleteNode` | `{ slot, nodeId }` | Re-inserts captured `node` at its original `parentId` and `index`. |
| `moveNode` | `{ slot, nodeId, targetParentId, targetIndex }` | Restores `nodeId` to `prevParentId` and `prevIndex`. |
| `updateProps` | `{ slot, nodeId, patch }` | Restores previous prop values for keys in `patch`. |
| `updateStyles` | `{ slot, nodeId, stylesPatch }` | Restores previous style values for keys in `stylesPatch`. |
| `replaceTree` | `{ slot, nextTree }` | Restores `prevTree` (used for initial load or full AI scaffold replacement). |

### 4.2 Validation Gate on Dispatch
Before committing a command to `documentTree`, `dispatch()` verifies:
1. Target `type` exists in `ELEMENT_REGISTRY` (`grex-js/src/elements.js` / `interactive.js`).
2. `validateElementNode(candidateNode)` passes with zero security or schema errors (no `<div>`, no unsafe URLs, nesting `<= 24`).
3. Invalid commands are rejected without mutating `documentTree` or pushing onto `undoStack`.

---

## 5. Element Palette, Structure Tree & Inspector (`v0.1`)

All studio panels are rendered using `Grex JS v1.0.0` native elements (`Section`, `Stack`, `Grid`, `Nav`, `Button`, `Input`, `Select`, `Tabs`, `Text`, `Heading`) with **zero wrapper `<div>` elements**:
- **Element Palette:** Reads `exportElementCatalog()` (`20` native elements grouped by `layout`, `typography`, `media`, `navigation`, `interactive`, `form`). Clicking or dragging an element dispatches `insertNode`.
- **Structure Tree:** Renders a semantic `<nav aria-label="Structure Tree">` nested list reflecting the exact node hierarchy, allowing selection, reordering (`moveNode`), and deletion (`deleteNode`).
- **Basic Property & Accessibility Inspector (`v0.1`):** Edits node semantic `tag` (from `allowedTags`), core `props` (e.g., `Heading.level`, `Text.content`, `Link.href`, `Image.alt`, `Image.isDecorative`), inline `styles` (from `supportedStyleProps`), and displays live `auditAccessibility()` warnings/errors (contrast, heading order, missing `alt`, missing form labels).

---

## 6. Split-Screen Live Preview (`GrexPreviewBridge`)

The studio hosts a split-screen preview pane (`<iframe>` loaded from the active GrabLab preview route on the same origin) wired through `Grex JS v1.0.0`'s `createPreviewBridge`:
- **Strict Origin Allowlist:** `createPreviewBridge({ allowedOrigins: [window.location.origin], ... })`. Wildcard `"*"` is strictly rejected (`GrexSecurityError`).
- **Channel:** `PREVIEW_CHANNEL` (`"grex-preview-v1"`).
- **Zero-Restart Patching:**
  - Property text edits dispatch `{ type: "patch-text", targetId, value }`.
  - Attribute/URL edits dispatch `{ type: "patch-attr", targetId, attr, value }`.
  - Style edits dispatch `{ type: "patch-style", targetId, prop, value }`.
  - Token edits dispatch `{ type: "patch-token", targetId, token, value }`.
  - Structural edits (`insertNode`, `moveNode`, `deleteNode`) send a validated tree-sync signal (`patch-signal`) or re-render the preview slot in browser memory without restarting Grisp workers.

---

## 7. Draft / Publish & `--read-only` Docker `/static/grex/` Sync

| Action | Storage & Cache Behavior | Visitor Impact |
|---|---|---|
| **Save Draft** | Sends validated `documentTree` to GrabLab draft persistence (`use data` / `POST /api/mcp/tools/update_entry_layout` or draft theme endpoint with CSRF token). | **Zero impact** on live visitors; `use cache` is not promoted to live. |
| **Publish** | 1. Re-runs `validateElementNode()` + `auditAccessibility()` (blocks publish on critical errors).<br>2. Promotes layout JSON to live GrabLab storage.<br>3. Triggers GrabLab `use cache` epoch invalidation.<br>4. Compiles deterministic CSS via `compileElementStyles()` + `compileTokenCss()` strictly into `/static/grex/builder.css` and `/static/grex/tokens.css`. | **Instant live update** with zero Grisp restarts; `server.asset` serves `/static/grex/builder.css?v=<12-char-sha256>` with immutable caching. |

---

## 8. `v0.1` Acceptance & Verification Gate

`v0.1` is complete only when all checks pass 100%:
1. `grex-builder` installs and activates in **GrabLab CMS v1.0.0** via `POST /api/themes/activate` as an exclusive `mode: "visual"` theme, deactivating the prior theme cleanly.
2. `createBuilderStore` runs 100% on `Grex JS v1.0.0` signals with zero Vue/Pinia/Webpack/Node runtime dependencies.
3. All 20 elements from `grex.elements.json` can be inserted, selected, reordered, edited, undone, and redone via the deterministic command stack.
4. `GrexPreviewBridge` rejects untrusted origins and patches text/attributes/styles/tokens in browser memory without Grisp restarts.
5. **Save Draft** isolates unpublished changes from live visitors; **Publish** invalidates `use cache` and writes valid CSS to `/static/grex/` compatible with `--read-only` Docker + `server.asset`.
6. Zero wrapper `<div>` elements appear in any studio markup or rendered canvas output, and `auditAccessibility()` passes on all starter templates.
