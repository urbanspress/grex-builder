# Grex Theme Builder — Handoff Ledger

**Last Updated:** 2026-11-14  
**Active Owner:** Google Antigravity  
**Current Milestone State:** **`v0.3.0` COMPLETE & VERIFIED** (`v0.1.0` + `v0.2.0` + `v0.3.0` shipped & verified)

## Completed Milestones
- **`v0.1.0`:** Bootstrap, `mode: "visual"` theme contract, `createBuilderStore`, deterministic `commands.js`, split-screen `studio.js`, origin-checked `GrexPreviewBridge`, GRAB Draft/Publish workflow, 100% E2E verification, PDF walkthrough, and synchronized `origin` + `stable` releases.
- **`v0.2.0`:** Committed vector badges in `docs/badges/`, Global Theme Token Editor & WCAG AA contrast warnings (`GREX-A11Y-001`), Bricks-Style Reusable Class Manager (`createClassManager`), Responsive Breakpoint Switcher (`Desktop >= 1025px`, `Tablet <= 1024px`, `Mobile <= 767px`), structured Style Inspector, zero-FOUC CSS-first Publish, 10/10 Node + 5/5 E2E verification gates, PDF guide, and synchronized `v0.2.0` releases.
- **`v0.3.0`:** Conditional Theme Builder & template assignment engine (`header`, `footer`, `home`, `single`, `archive`, `search`, `404` + reusable parts; specificity resolution, `exclude` rules, and `GREX-TPL-CONFLICT` Publish gate), Visual Query Loop Builder (`ForEach` + GrabLab `query_entries` with zero wrapper `<div>`), Dynamic Data Picker (`GrabDecimal`/`GrabInteger`-exact + XSS/URL guards), Media Library & Navigation Menu Pickers (`GREX-A11Y-002`, `/api/media`, `/api/menus`), toolbar **Live Preview Context Selector** (*Preview As*), standalone GRAB API routes (`/api/query`, `/api/media`, `/api/menus`, `/api/menus/{location}`, `/api/preview/context`), 6 deterministic undo/redo commands (`setTemplateConditions`, `upsertTemplate`, `configureQueryLoop`, `bindDynamicField`, `bindMediaAsset`, `bindNavigationMenu`), 15/15 Node unit/DOM/a11y tests + 5/5 Python E2E gates passing at 100%, `Grex-Builder-v0.3.0-Guide.pdf`, packaged theme archive & checksums.

## Next Recommended Action
- Draft and seek owner approval for `specifications/GREX-BUILDER-SPEC-004.md` (`v0.4` — Revision History Snapshots, One-Click Rollback & `GRAB-DESIGN-SYSTEM.md` AI Guardrails for `grab mcp`).
