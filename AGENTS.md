# AGENTS.md — Grex Theme Builder

**Grex Theme Builder** is Step 3 of the Post-1.0 GRAB Ecosystem: a responsive-first visual page and conditional theme builder built purely on **GRAB v1.1.0**, **GrabLab CMS v1.0.0**, and **Grex JS v1.0.0** (zero Vue, Pinia, Node, Webpack, or Vite bloat).

---

## 1. Core Invariants
Before designing, editing, or reviewing any file, read [GREX-BUILDER-EXPERT.md](file:///C:/Development/grex-builder/GREX-BUILDER-EXPERT.md). All four invariant pillars are mandatory.

---

## 2. Workflow & Verification Gates
- **Spec-First Gate:** Do NOT write application code until the active milestone specification (starting with `specifications/GREX-BUILDER-SPEC-001.md`) is explicitly approved by the project owner.
- **No Unapproved Commits/Pushes:** Do not commit or push code changes without project owner approval (initial repository bootstrap excepted when explicitly requested).
- **Mandatory Test & Lint Gate:** Before marking any implementation task complete:
  1. Run `grab check` and `grab format` verification on any `.grab` / `.grab.html` files.
  2. Run the full automated unit, DOM, accessibility (`auditAccessibility()`), and GrabLab integration test suite with **100% passing results**.
  3. Verify zero wrapper `<div>` elements in all rendered canvas and editor outputs.
- **Two-Repository Workflow & Release Protection:**
  - `origin` (`https://github.com/urbanspress/grex-builder.in.progress.git`): Active development repository for ongoing work, specifications, and in-progress milestone commits.
  - `stable` (`https://github.com/urbanspress/grex-builder.stable.git`): Production release repository for 100% verified milestone releases only.
  - **Strict `stable` Protection:** Push work-in-progress commits, drafts, and specs ONLY to `origin` (`urbanspress/grex-builder.in.progress`). Pushing to `stable` (`urbanspress/grex-builder.stable`) is strictly forbidden unless the milestone is 100% `Complete` in `docs/ROADMAP.md`, all verification gates pass 100%, and `HANDOFF.md` records no pending milestone tasks.
  - **Synchronized Releases & Plain-English Walkthrough PDF:** Whenever a completed milestone (`v0.1.0` onward) is promoted to `stable`, push `main` and annotated version tags in ascending chronological order to both `origin` and `stable`, generate the plain-English walkthrough PDF (`docs/releases/pdf/GREX-BUILDER-v<X.Y.Z>-Guide.pdf`), packaged theme archive, and `SHA256SUMS.txt`, and publish/attach matching GitHub Releases and assets to **both** repositories (`urbanspress/grex-builder.in.progress` and `urbanspress/grex-builder.stable`).
- **Brand Naming Invariant:** Always write **Grex Theme Builder** in human-facing prose, headings, UI labels, PDF guides, and release notes, reserving `grex-builder` strictly for machine slugs (`urbanspress/grex-builder.in.progress`, `urbanspress/grex-builder.stable`, directory paths, `"slug": "grex-builder"`, and archive filenames).

---

## 3. Model Routing & Tandem Handoff
- **Current Owner:** Google Antigravity
- **Recommended Model & Effort Routing:**
  - **Google Hydrogen (Medium):** Routine documentation, sample layouts, straightforward UI panels, and table-driven tests.
  - **Google Hydrogen (High):** Core reactive `createBuilderStore`, command history stack, `GrexPreviewBridge` integration, and GrabLab API/theme contracts.
  - **Google Hydrogen (Extra):** Complex CSS token/breakpoint compiler, security boundary hardening, and multi-layer integration debugging.
- **Handoff Rule:** If a core bug or architectural blocker remains unresolved after 2 attempts, stop, revert only your own failed edits, record the state in `HANDOFF.md`, and hand off cleanly.

---

## 4. User Communication
- The project owner directs development in plain English. Always explain architecture, design choices, and test results clearly without unnecessary jargon.
- Handle all file edits, git operations, and terminal checks directly.
