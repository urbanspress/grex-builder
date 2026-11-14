# GREX-BUILDER-SPEC-003: Grex Theme Builder `v0.3` — Conditional Theme Builder, Query Loop Builder & Dynamic Data Pickers

**Status:** Complete &amp; Verified (`2026-11-14`)  
**Milestone:** `v0.3` (`v0.3.0`) — Conditional Theme Builder, Visual Query Loop Builder & Dynamic Data/Media/Menu Pickers  
**Upstream Baselines:**
- **GRAB:** `v1.1.0` (`grab serve --allow-scripts`, `grab check`, `grab format <file>`, `grab mcp`, `server.asset`, `use cache`, `use data`)
- **Grex JS:** `v1.0.0` (`ForEach`, `createBuilderStore`, `createTheme`, `createClassManager`, `auditAccessibility`, `validateElementNode`, `createPreviewBridge`)
- **GrabLab CMS:** `v1.0.0` (`GRABLAB-SPEC-100.md` — `mode: "visual"`, `query_entries` + `filter_by_term`, `/api/media`, `/api/menus`, `GrabDecimal`/`GrabInteger` wire strings, `use cache` epoch invalidation)

---

## 1. Purpose & `v0.3` Scope

`GREX-BUILDER-SPEC-003` defines **Grex Theme Builder `v0.3.0`**, turning the `v0.2.0` design-system studio into a **full conditional WordPress/Bricks-caliber theme builder** while strictly upholding all four pillars of [GREX-BUILDER-EXPERT.md](../GREX-BUILDER-EXPERT.md):
- **100% `Grex JS v1.0.0` Signals:** Zero Vue, Pinia, React, Node.js, Webpack, or Vite bloat.
- **Zero Wrapper `<div>` Bloat:** Every template part, query loop container (`Grid`, `Stack`, `Section`), looped card (`article`), and navigation menu (`nav > ul > li > a`) renders clean semantic HTML5.
- **1:1 Visual Canvas Parity & Zero-FOUC Publish:** Preview renders live GrabLab data through `GrexPreviewBridge` with zero Grisp restarts; Publish writes compiled CSS to `/static/grex/` before updating active templates and invalidating `use cache`.
- **Groxy AI Parity:** Every template condition, query loop, and dynamic binding is a deterministic, undoable command in `createBuilderStore`.

### Included in `v0.3`
1. **Conditional Theme Builder & Template Assignment Engine:** Multiple named templates (`header`, `footer`, `single`, `archive`, `search`, `404`) and reusable global parts (`card`, `hero`, `cta`) with deterministic display conditions and conflict detection.
2. **Visual Query Loop Builder (`ForEach` + GrabLab `query_entries`):** Visual loop configuration on `Grid`, `Stack`, or `Section` containers with live `query_entries` filtering, sorting, and pagination.
3. **Dynamic Data, Media Library & Navigation Menu Pickers + Live Preview Context Selector:** Safe field bindings (`GrabDecimal`/`GrabInteger`-exact), `/api/media` picker with WCAG AA `alt` enforcement, `/api/menus` location picker, and a toolbar **Live Preview Context Selector** (*Preview As: Front Page / Specific Entry / Specific Term Archive*) feeding real sample records into `GrexPreviewBridge` during editing.
4. **Deterministic Undo/Redo Commands & Acceptance Gates:** Five new reversible commands shared with **Groxy AI** (`grab mcp`) plus full E2E verification gates.

### Deferred to `v0.4` / `v1.0.0`
- Revision history snapshots & one-click rollback (`v0.4`)
- `GRAB-DESIGN-SYSTEM.md` AI guardrails & `/api/mcp` layout composition checks (`v0.4`)
- `--read-only` Docker E2E production hardening (`v1.0.0`)

---

## 2. Conditional Theme Builder & Template Assignment Engine

### 2.1 Named Templates & Reusable Global Parts
`v0.3` expands the fixed `v0.1` slot map into a **multi-template registry** stored in GrabLab `use data` (`studio_templates` / `theme_templates`):
- **Theme Slots:** `header`, `footer`, `home`, `single`, `archive`, `search`, `404`
- **Reusable Global Parts:** `card`, `hero`, `cta` (insertable into any template by `partId` with single-source cascade)

Each template record has:
```json
{
  "id": "tpl_single_product",
  "name": "Product Single Layout",
  "slot": "single",
  "priority": 20,
  "conditions": [
    { "type": "content_type", "value": "product", "operator": "include" }
  ],
  "tree": { "...": "validated grex.elements.json node tree" }
}
```

### 2.2 Supported Display Conditions
| Condition Type | Value Shape | Example |
|---|---|---|
| `entire_site` | `null` | Default site-wide `header` / `footer` |
| `front_page` | `null` | Homepage (`/` / `home` slot) |
| `all_posts` | `null` | All `post` entries |
| `content_type` | `string` (slug) | `"post"`, `"page"`, `"product"`, or custom type |
| `taxonomy_term` | `{ taxonomy, term }` | `{ "taxonomy": "category", "term": "guides" }` |
| `entry_slug` | `string` | Specific page/entry slug (e.g. `"/pricing"`) |
| `page_404` | `null` | 404 Not Found responses |
| `search_results` | `null` | `/search?q=...` responses |

### 2.3 Deterministic Resolution & Conflict Detection
1. **Specificity Order (Highest Wins):** `entry_slug` (100) > `taxonomy_term` (80) > `content_type` (60) > `all_posts` / `front_page` / `search_results` / `page_404` (50) > `entire_site` (10).
2. **Tie-Breaker:** Higher explicit `priority` integer, then lexicographical `id` order — guaranteeing 100% deterministic template selection across all Grisp workers.
3. **Exclude Rules:** Conditions with `"operator": "exclude"` override matching `"include"` rules on the same template.
4. **Conflict Detection (`GREX-TPL-CONFLICT`):** When two templates for the same `slot` share identical `conditions` and equal `priority`, the Studio displays a live warning badge identifying both conflicting templates and blocks **Publish** until resolved (via priority adjustment or condition narrowing).

---

## 3. Visual Query Loop Builder (`ForEach` + GrabLab `query_entries`)

### 3.1 Loop Container Attachment
Authors can enable **Query Loop** on any `Grid`, `Stack`, or `Section` container in the Inspector without adding wrapper `<div>` elements. The container renders its direct child template (e.g., an `article` or `Card` element) once per returned item using `Grex JS v1.0.0` keyed `ForEach` reconciliation.

### 3.2 Query Configuration Schema
```json
{
  "queryLoop": {
    "enabled": true,
    "content_type": "post",
    "filter_by_term": { "taxonomy": "category", "slug": "news" },
    "custom_field_filters": [
      { "key": "featured", "op": "eq", "value": "true" }
    ],
    "order_by": "published_at",
    "order_dir": "desc",
    "per_page": 12,
    "page": 1,
    "empty_text": "No matching entries found."
  }
}
```
- **Bounds & Security:** `per_page` is clamped to `1..50`; all filters map strictly to GrabLab's prepared-SQL `query_entries` / `GET /api/query` parameters (never raw SQL strings).
- **Pagination:** Supports clean query-string pagination (`?page=2`) preserving existing filter parameters and emitting semantic `<nav aria-label="Pagination">`.

---

## 4. Dynamic Data, Media Library & Navigation Menu Pickers

### 4.1 Dynamic Data Picker (Exact `GrabDecimal` / `GrabInteger` Integrity)
Any text-bearing element (`Heading`, `Text`, `Link`, `Button`, `Image`) can bind a prop to a GrabLab token expression `{{ ... }}` via the **Dynamic Data Picker** popover:
- **Entry Tokens:** `entry.title`, `entry.slug`, `entry.excerpt`, `entry.published_at`, `entry.author_name`, `entry.custom_fields.<key>`
- **Taxonomy & Site Tokens:** `term.name`, `term.slug`, `site.title`, `site.tagline`
- **Exact Wire Integrity (`ADR-025c`):** `GrabInteger` and `GrabDecimal` custom fields (e.g., `"19.95"`, `"1000.00"`) are formatted and rendered strictly as exact base-10 strings without IEEE-754 float coercion.
- **XSS Safety:** All bound dynamic strings render via `textContent` (or URL-validated `href`/`src` blocking `javascript:` and unsanitized `data:`), never `innerHTML`.

### 4.2 Media Library Picker (`/api/media`)
- Queries GrabLab `GET /api/media` with search/pagination inside an accessible `<dialog>` modal.
- Selecting an image binds `src`, `width`, `height` (CLS prevention), and `alt`.
- **WCAG AA `alt` Enforcement (`GREX-A11Y-002`):** If the selected media item has empty `alt_text` and `is_decorative` is `false`, the picker requires the author to enter descriptive `alt` text or explicitly mark the image decorative (`alt=""` + `aria-hidden="true"`) before binding.

### 4.3 Navigation Menu Picker (`/api/menus`)
- `Nav` elements bind to GrabLab menu locations (`primary`, `footer`, `mobile`) via `GET /api/menus` / `GET /api/menus/{location}`.
- Renders clean semantic `<nav><ul><li><a href="...">` markup with `aria-current="page"` on active routes and zero wrapper `<div>`s.

### 4.4 Live Preview Context Selector (*Preview As*)
- The Studio toolbar includes a semantic **Preview As** selector (`Front Page`, `Specific Entry`, `Specific Term Archive`, `Search Results`, `404 Page`) plus optional target entry/term picker populated from GrabLab records (`/api/query`, `/api/menus/{location}`).
- Switching preview context pushes the resolved entry, archive items, term, and site context into `GrexPreviewBridge` (`contextSync` signal) with zero Grisp restarts so dynamic `{{ entry.* }}` / `{{ term.* }}` / `{{ site.* }}` tokens and `ForEach` Query Loops render live with real data while designing.

---

## 5. Deterministic Undo/Redo Commands (`createBuilderStore`)

All `v0.3` mutations execute as serializable, reversible command objects in `theme/assets/commands.js` so human designers and **Groxy AI** (`grab mcp` / `/api/mcp`) share identical state transitions:

| Command Type | Payload | Undo Behavior |
|---|---|---|
| `setTemplateConditions` | `{ templateId, conditions, priority }` | Restores previous `conditions` & `priority` |
| `configureQueryLoop` | `{ nodeId, queryLoop }` | Restores previous `queryLoop` config (or `null`) |
| `bindDynamicField` | `{ nodeId, prop, token }` | Restores previous static/bound prop value |
| `bindMediaAsset` | `{ nodeId, mediaId, src, alt, width, height, isDecorative }` | Restores previous media props |
| `bindNavigationMenu` | `{ nodeId, location }` | Restores previous `Nav` menu location |

---

## 6. Acceptance & Verification Gates

`v0.3.0` is complete only when all gates pass **100%**:
1. **Unit & Command Parity Tests (`node --test tests/*.test.js`):**
   - Deterministic template condition resolution (specificity, exclude rules, tie-breakers, and `GREX-TPL-CONFLICT` detection).
   - Full `execute` / `undo` / `redo` round-trips for all 5 new commands.
   - `GrabDecimal` / `GrabInteger` exact string preservation in dynamic data bindings (`"19.95"` stays `"19.95"`).
   - XSS/URL-sanitization rejection on dynamic `href`/`src` bindings.
2. **DOM & Accessibility Tests:**
   - `ForEach` query loop renders `Grid`/`Stack`/`Section` > `article` with **zero wrapper `<div>` elements**.
   - `Nav` menu binding renders semantic `<nav><ul><li><a>` with `aria-current="page"`.
   - `GREX-A11Y-002` blocks non-decorative images missing `alt` text; `auditAccessibility()` passes 100%.
3. **GRAB & GrabLab E2E Integration (`tests/integration_e2e.py`):**
   - `grab check` and canonical `grab format` verification pass on all `.grab` and `.grab.html` files.
   - Live Grisp studio + GrabLab API integration test verifying conditional template matching (`single` by `content_type`, `archive` by `taxonomy_term`, `404`), `query_entries` loop rendering, `/api/media`, and `/api/menus`.
4. **Release Assets:** Plain-English walkthrough PDF (`docs/releases/pdf/Grex-Builder-v0.3.0-Guide.pdf`), packaged theme archive, `SHA256SUMS.txt`, and synchronized GitHub Releases on `urbanspress/grex-builder.progress` and `urbanspress/grex-builder.stable`.
