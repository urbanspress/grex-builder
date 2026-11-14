# GREX-BUILDER-EXPERT.md — Non-Negotiable Invariants

This checklist defines the **never-break invariants** for **Grex Theme Builder (`grex-builder`)**. Every specification, module, PR, and release must satisfy all four pillars.

---

## 1. Exclusive `mode: "visual"` GrabLab Theme Contract
- **Theme, Never Plugin:** `grex-builder` MUST ship as a valid GrabLab CMS theme package (`theme.json` with `"schemaVersion": "1.0.0"`, `"mode": "visual"`, `"engine": "grex-visual"`). Third-party plugin manifests or arbitrary executable hooks are forbidden (`GRAB-E401`).
- **Exclusive Template Ownership:** When activated via GrabLab `/admin/themes` (`POST /api/themes/activate` or `POST /api/admin/themes/activate`), `grex-builder` automatically deactivates the prior active theme and takes **100% exclusive template rendering control** across required slots (`home`, `single`, `archive`, `404`, plus optional `search` and `parts`).
- **Package & Hook Boundaries (`GRAB-E401`):**
  - Permitted capabilities only: `["templates", "parts", "hooks:theme", "grex:visual", "assets:static"]`.
  - Permitted theme hooks only: `theme:head_meta`, `theme:before_render`, `query:modify_args`, `content:before_save` using GrabLab's allowlisted handler identifiers.
  - Max directory depth `8`, max `250` files, max `5 MB` per file, max `25 MB` total, and only GrabLab-allowlisted extensions (`.json`, `.grab.html`, `.css`, `.js` under `assets/`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.woff2`).

---

## 2. Zero Vue/Pinia/Webpack Bloat & 100% `grex.elements.json` Compliance
- **Pure Grex JS v1.0.0 Runtime:** The editor UI, reactive state (`createBuilderStore`), theme/class managers (`createTheme`, `createClassManager`), and preview bridge run **100% on `Grex JS v1.0.0` signals** (`signal`, `computed`, `effect`, `batch`, `untrack`). Zero Vue, Pinia, React, Node.js, Webpack, or Vite runtime/build dependencies are permitted.
- **Zero Wrapper `<div>` Bloat:** Every canvas element and editor container uses semantic HTML (`<section>`, `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`) from `grex.elements.json` (20 native elements).
- **1:1 Visual Canvas Parity:** The split-screen preview iframe MUST always render using the exact same `Grex JS v1.0.0` element renderer (`renderNode`) and `createTheme` / `createClassManager` CSS compiler as the live public site—never a separate mock renderer or divergent stylesheet.
- **Mandatory Validation & Accessibility Gate:**
  - Every node in the canvas tree MUST pass `validateElementNode()` from `grex-js`.
  - Every rendered tree MUST pass `auditAccessibility()` / `auditDom()` WCAG AA checks (headings hierarchy, landmarks, contrast, alt text / decorative flags, keyboard `:focus-visible`).
  - Reject `<div>`, `<script>`, `<iframe>`, `<object>`, `<style>`, inline `on*` attributes, `innerHTML`, unsafe URLs (`javascript:`, unsanitized `data:`), and nesting deeper than `24` levels.

---

## 3. Fluid Grisp / `--read-only` Docker Sync & GRAB v1.1.0 CLI Rules
- **Exact `GRAB 1.1.0` CLI & CSP Rules:**
  - `.grab` formatting MUST be verified by comparing `grab format <file>` stdout against file contents (never `--check`, which is unsupported in GRAB 1.1.0).
  - Studio servers MUST run with `grab serve --allow-scripts` so the `Grex JS` studio runtime executes cleanly under strict CSP.
- **Zero-Restart Live Preview:** Split-screen canvas edits patch browser memory directly over `GrexPreviewBridge` (`PREVIEW_CHANNEL = "grex-preview-v1"`) with strict `allowedOrigins` validation (wildcard `"*"` is forbidden). Zero Grisp worker restarts occur during editing.
- **Draft vs. Publish Isolation & Zero-FOUC Atomic Stylesheet Swap:**
  - **Save Draft** persists draft layout JSON to GrabLab `use data` (`entries` / theme draft storage) without affecting live visitor traffic.
  - **Publish** MUST write the compiled CSS files (`tokens.css`, `builder.css`) to `/static/grex/` (mounted writable in `--read-only` Docker containers) **before** updating the active layout version in `use data` and invalidating `use cache`—so visitors never see a single frame of unstyled content (zero FOUC), and `server.asset` serves `/static/grex/...?v=<12-char-sha256>` with immutable caching.

---

## 4. Deterministic Command History for Groxy AI
- **Structured Command Stack:** Every canvas mutation (insert, move, reorder, update props, update tokens/styles, delete, replace) MUST execute as a deterministic, reversible command object (`execute` / `undo` / `redo`) inside `createBuilderStore`.
- **AI Parity (`grab mcp` / `/api/mcp`):** Because every mutation is a serializable command validated against `grex.elements.json`, **Groxy AI** can inspect, compose, and undo/redo layouts safely alongside human designers without corrupting state or bypassing `validateElementNode()` and `auditAccessibility()`.
