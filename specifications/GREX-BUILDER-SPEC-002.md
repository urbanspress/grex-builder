# GREX-BUILDER-SPEC-002: Grex Theme Builder `v0.2` — Bricks-Style Class/Theme Inspector & Responsive Breakpoints

**Status:** Approved Target — Specification in Review (`2026-11-14`)  
**Milestone:** `v0.2` (`v0.2.0`) — Global Theme Token Studio, Reusable Class Manager, Responsive Breakpoints & Structured Style Inspector  
**Upstream Baselines:**
- **GRAB:** `v1.1.0` (`grab serve --allow-scripts`, `grab check`, `grab format <file>`, `grab mcp`, `server.asset`, `use cache`, `use data`)
- **Grex JS:** `v1.0.0` (`createTheme`, `createClassManager`, `compileTokenCss`, `compileElementStyles`, `computeContrastRatio`, `auditAccessibility`, `validateElementNode`, `createPreviewBridge`, `ALLOWED_STYLE_PROPERTIES`)
- **GrabLab CMS:** `v1.0.0` (`GRABLAB-SPEC-100.md` — `mode: "visual"`, `--read-only` `/static/grex/` atomic CSS assets, `use cache` epoch invalidation)

---

## 1. Purpose & `v0.2` Scope

`GREX-BUILDER-SPEC-002` defines **Grex Theme Builder `v0.2.0`**, upgrading the `v0.1.0` visual shell into a full **Bricks-style design system and responsive styling studio** while preserving all four pillars of [GREX-BUILDER-EXPERT.md](../GREX-BUILDER-EXPERT.md):
- Zero Vue, Pinia, React, Node.js, Webpack, or Vite bloat (`100%` `Grex JS v1.0.0` signals).
- Zero wrapper `<div>` elements in studio UI or rendered site output.
- 1:1 visual canvas parity between the split-screen preview iframe and the live public site.
- Zero-FOUC atomic stylesheet swap on **Publish**.

### Included in `v0.2`
1. **Global Theme Token Editor (`createTheme` Integration):** Visual `--grex-*` token studio (brand colors, typography scale, spacing scale, border radii, shadows, focus rings, Light/Dark modes) with live WCAG AA `GREX-A11Y-001` contrast warnings (`< 4.5:1`).
2. **Bricks-Style Reusable Class Manager (`createClassManager` Integration):** Visual `.grex-c-*` class selector, creator, renamer, duplicator, and element assignment UI so editing a class updates every matching element site-wide.
3. **Responsive Breakpoint Switcher & Per-Breakpoint Overrides:** Top toolbar switcher (`Desktop >= 1025px`, `Tablet <= 1024px`, `Mobile <= 767px`) resizing the `GrexPreviewBridge` canvas and compiling deterministic `base`, `tablet`, and `mobile` media-query CSS into `/static/grex/`.
4. **Structured Visual Inspector:** Dedicated **Box-Model**, **Layout (Flex/Grid)**, **Typography**, and **Border/Background** property panels backed by deterministic undo/redo commands (`setThemeToken`, `upsertClass`, `assignClass`, `setBreakpointStyle`).

### Deferred to Later Milestones
- Conditional display rules, Visual Query Loop Builder (`ForEach`), and dynamic data/media/menu pickers (`v0.3`)
- Revision history, one-click rollback, and `GRAB-DESIGN-SYSTEM.md` AI guardrails (`v0.4`)

---

## 2. Store & Document Model Extensions (`createBuilderStore`)

`createBuilderStore` (`theme/assets/store.js`) extends the `v0.1` document state with global design-system state while remaining 100% JSON-serializable for GrabLab `use data` persistence and **Groxy AI** (`grab mcp`) parity.

### 2.1 New Signals & Computed State
| State Member | Type | Description |
|---|---|---|
| `themeConfig` | `signal<ThemeConfig>` | Global `--grex-*` base tokens, `modes.light`, `modes.dark`, and `prefersColorScheme` flag passed to `createTheme()`. |
| `activeThemeMode` | `signal<"light" \| "dark">` | Currently previewed theme mode in the Studio and `GrexPreviewBridge` (`[data-grex-theme="..."]`). |
| `classRegistry` | `signal<Record<string, BreakpointStyleMap>>` | Map of clean class names (e.g. `"hero-card"`) to `{ base, tablet, mobile }` style declarations compiled via `createClassManager({ prefix: "grex-c-" })`. |
| `activeClassName` | `signal<string \| null>` | When non-null, inspector style edits target `.grex-c-<activeClassName>` instead of the selected element's ID-level `styles`. |
| `activeBreakpoint` | `signal<"base" \| "tablet" \| "mobile">` | Active responsive viewport (`base` = Desktop `>= 1025px`, `tablet` `<= 1024px`, `mobile` `<= 767px`). |
| `contrastWarnings` | `computed<ContrastWarning[]>` | Live WCAG AA (`4.5:1`) contrast audit across configured foreground/background token pairs and active element/class color pairs. |

### 2.2 Breakpoint Contract (`BUILDER_BREAKPOINTS`)
`grex.js` exports `DEFAULT_BREAKPOINTS` with `mobile: "(max-width: 640px)"`. To match the `v0.2` responsive specification, `grex-builder` passes an explicit breakpoint map to `compileTokenCss()`, `compileElementStyles()`, and `classManager.compileCss()`:

```js
export const BUILDER_BREAKPOINTS = Object.freeze({
  base: null,                  // Desktop >= 1025px (unwrapped base rules)
  tablet: "(max-width: 1024px)", // Tablet <= 1024px
  mobile: "(max-width: 767px)",  // Mobile <= 767px
});
```

---

## 3. Global Theme Token Editor (`createTheme` Integration)

The **Theme Tokens** panel edits `themeConfig` and compiles `:root` and `[data-grex-theme="dark"]` CSS via `Grex JS v1.0.0` `createTheme(themeConfig)`:

### 3.1 Token Categories
1. **Brand & Surface Colors:** `--grex-color-primary`, `--grex-color-secondary`, `--grex-color-accent`, `--grex-color-bg`, `--grex-color-surface`, `--grex-color-text`, `--grex-color-text-muted`, `--grex-color-border`.
2. **Typography Scale:** `--grex-font-sans`, `--grex-font-heading`, `--grex-font-mono`, `--grex-text-base`, `--grex-text-sm`, `--grex-text-lg`, `--grex-text-xl`, `--grex-text-2xl`, `--grex-leading-normal`, `--grex-leading-tight`.
3. **Spacing Scale:** `--grex-space-1` through `--grex-space-8` (e.g. `0.25rem` to `4rem`).
4. **Radii, Shadows & Focus Ring:** `--grex-radius-sm`, `--grex-radius-md`, `--grex-radius-lg`, `--grex-shadow-sm`, `--grex-shadow-md`, `--grex-focus-ring` (default `2px solid #059669`, never removable to empty).
5. **Light / Dark Modes:** Independent token overrides under `themeConfig.modes.light` and `themeConfig.modes.dark`, plus a `prefersColorScheme` toggle and instant Light/Dark preview switch in the Studio toolbar.

### 3.2 Live WCAG AA Contrast Guardrails (`GREX-A11Y-001`)
Whenever any color token or foreground/background pair changes, `contrastWarnings` evaluates pairs (such as `--grex-color-text` on `--grex-color-bg`, `--grex-color-text` on `--grex-color-surface`, `--grex-color-text-muted` on `--grex-color-bg`, and button/primary text vs `--grex-color-primary`) in both `light` and `dark` modes using `computeContrastRatio(fg, bg)` from `grex.js`:
- **Threshold:** Any pair with contrast ratio `< 4.5` (`4.5:1`) emits a live `GREX-A11Y-001` warning badge showing the exact ratio (e.g., `3.21:1 — Below WCAG AA 4.5:1`) and the offending token pair.
- All token values are validated with `validateTokenValue()` before applying to `createTheme()` or dispatching to `GrexPreviewBridge`.

---

## 4. Bricks-Style Reusable Class Manager (`createClassManager` Integration)

The **Classes** bar at the top of the Inspector provides a Bricks-style workflow backed by `createClassManager({ prefix: "grex-c-" })`:

1. **Class Selector & Pills:** Displays all `.grex-c-*` classes attached to the selected element (`node.classes` / `node.attrs.class` tokens) plus a searchable dropdown of all classes in `classRegistry`.
2. **Create Class:** Typing a valid slug (`^[a-z][a-z0-9_-]*$`) creates a new class entry in `classRegistry` and attaches `.grex-c-<name>` to the selected element.
3. **Rename Class:** Renames a class key in `classRegistry` and updates every node across all slots (`home`, `single`, `archive`, `404`, `search`, `parts`) referencing the old class—all inside a single reversible command.
4. **Duplicate Class:** Clones an existing class's `{ base, tablet, mobile }` style map under a new `.grex-c-<newName>` and optionally attaches it to the selected element.
5. **Attach / Detach & Site-Wide Cascade:** Attaching or detaching a class updates the element's class list; editing styles while `activeClassName` is selected updates `classRegistry[activeClassName][activeBreakpoint]`, immediately patching every matching element in the `GrexPreviewBridge` iframe and compiling `.grex-c-<name>` rules into `/static/grex/builder.css`.

---

## 5. Responsive Breakpoint Switcher & Structured Visual Inspector

### 5.1 Top Toolbar Viewport Switcher
The Studio top bar adds a semantic `<nav aria-label="Responsive Breakpoints">` toggle group:
- **Desktop (`base`):** `>= 1025px` (preview iframe width `100%` / `1280px`).
- **Tablet (`tablet`):** `<= 1024px` (preview iframe width `768px`, badge `<= 1024px`).
- **Mobile (`mobile`):** `<= 767px` (preview iframe width `375px`, badge `<= 767px`).

Switching breakpoints updates `activeBreakpoint`, resizes the preview iframe container cleanly, and scopes all Inspector controls to that breakpoint. Controls show an indicator dot when an override is explicitly set at `tablet` or `mobile` (versus inherited from `base`).

### 5.2 Structured Inspector Panels
All Inspector inputs map strictly to `ALLOWED_STYLE_PROPERTIES` in `grex.js` and are validated with `normalizeStyleProperty()` + `validateTokenValue()`:

| Panel | Controlled CSS Properties |
|---|---|
| **Box Model** | `padding`, `padding-block`, `padding-inline`, `margin`, `margin-block`, `margin-inline` (visual 4-side / block-inline inputs with token quick-picks `--grex-space-*`) |
| **Layout (Flex / Grid)** | `display` (`flex`, `grid`, `block`, `inline-flex`), `flex-direction`, `justify-content`, `align-items`, `gap`, `grid-template-columns`, `grid-template-rows` |
| **Typography** | `font-family`, `font-size`, `font-weight`, `line-height`, `text-align`, `color` (with token picker & live `GREX-A11Y-001` contrast check against background) |
| **Border & Background** | `background`, `background-color`, `border`, `border-radius`, `box-shadow` |

---

## 6. Deterministic Undo/Redo Commands (`v0.2`)

All `v0.2` mutations execute through `store.dispatch(command)` inside `Grex JS` `batch(...)` so human designers and **Groxy AI** (`grab mcp`) share identical, reversible history:

| Command Type | Payload | Inverse (`undo`) |
|---|---|---|
| `setThemeToken` | `{ mode: "base" \| "light" \| "dark", token, value }` | Restores previous token value (or deletes if newly added) and re-compiles theme tokens. |
| `upsertClass` | `{ action: "create" \| "rename" \| "duplicate" \| "delete", name, nextName?, styles? }` | Restores previous `classRegistry` entry and any affected node class attachments across slots. |
| `assignClass` | `{ slot, nodeId, className, attached: boolean }` | Restores previous `attached` state on `nodeId`. |
| `setBreakpointStyle` | `{ target: "class" \| "node", className?, slot?, nodeId?, breakpoint: "base" \| "tablet" \| "mobile", patch }` | Restores previous property values (or deletes newly added keys) at that breakpoint. |

---

## 7. `GrexPreviewBridge` & Zero-FOUC Publish Pipeline

### 7.1 Live Preview Sync (1:1 Parity)
The preview iframe (`theme/assets/preview-host.js`) renders using the exact same `Grex JS v1.0.0` `renderNode()` renderer and live compiled `<style id="grex-live-tokens">` / `<style id="grex-live-classes">` / `<style id="grex-live-elements">` sheets generated by `createTheme()`, `createClassManager()`, and `compileElementStyles(..., { breakpoints: BUILDER_BREAKPOINTS })`:
- `setThemeToken` -> dispatches `patch-token` / live theme `<style>` update + `data-grex-theme` mode attribute.
- `upsertClass` / `setBreakpointStyle` (class target) -> dispatches compiled class CSS update in browser memory (zero Grisp restarts).
- `assignClass` -> patches element `class` attribute in preview DOM.
- `setBreakpointStyle` (node target) -> dispatches compiled element CSS rule for `.grex-el-<id>` across `base` / `tablet` / `mobile`.

### 7.2 Zero-FOUC Atomic Publish Order (`src/studio.grab`)
On **Publish**, the studio server MUST execute in strict order:
1. Validate all slots with `validateElementNode()` and `auditAccessibility()` (blocking publish on critical errors).
2. Compile deterministic CSS using `createTheme(themeConfig).compileCss()`, `classManager.compileCss({ breakpoints: BUILDER_BREAKPOINTS })`, and `compileElementStyles(allRoots, { breakpoints: BUILDER_BREAKPOINTS })`.
3. **Write `/static/grex/tokens.css` and `/static/grex/builder.css` FIRST** (atomic write to `/static/grex/`).
4. **Update active layout version & design-system JSON in GrabLab `use data` SECOND**, and **invalidate `use cache` epochs THIRD**.
5. Serve `/static/grex/tokens.css?v=<12-char-sha256>` and `/static/grex/builder.css?v=<12-char-sha256>` via `server.asset` so visitors never observe a single frame of unstyled content.

---

## 8. `v0.2` Acceptance & Verification Gate

`v0.2.0` is complete only when **100%** of the following gates pass:
1. **GRAB CLI & Format Gate:**
   - `grab check` passes on all `.grab` and `.grab.html` files.
   - Canonical formatting verified by comparing `grab format <file>` stdout against file contents (never `--check`).
   - Studio server runs with `grab serve --allow-scripts` under strict CSP.
2. **Zero Wrapper `<div>` & 1:1 Parity Gate:**
   - Zero `<div>` elements exist in any rendered studio panel, inspector, or preview canvas output.
   - Preview iframe renders via `Grex JS v1.0.0` `renderNode()` + `createTheme()` / `createClassManager()` identical to live output.
3. **Theme Token & WCAG AA Contrast Gate:**
   - Editing `--grex-*` tokens updates Light/Dark modes and emits `GREX-A11Y-001` warnings whenever `computeContrastRatio(fg, bg) < 4.5`.
4. **Reusable Class Manager & Cascade Gate:**
   - Creating, renaming, duplicating, and assigning `.grex-c-*` classes updates all matching elements across slots in preview and compiled CSS.
5. **Multi-Breakpoint CSS Compilation Gate:**
   - `setBreakpointStyle` produces deterministic unwrapped `base` rules (`>= 1025px`), `@media (max-width: 1024px)` (`tablet`), and `@media (max-width: 767px)` (`mobile`) in `/static/grex/builder.css`.
6. **Undo/Redo Command Parity Gate:**
   - `setThemeToken`, `upsertClass`, `assignClass`, and `setBreakpointStyle` are 100% reversible (`undo` -> `redo` restores exact state and compiled CSS).
7. **Zero-FOUC Publish & E2E Gate:**
   - Automated E2E test verifies `/static/grex/tokens.css` and `/static/grex/builder.css` are written on disk *before* `use data` live version promotion and `use cache` epoch invalidation.
   - `node --test tests/*.test.js` and `python tests/integration_e2e.py` pass 100%.
