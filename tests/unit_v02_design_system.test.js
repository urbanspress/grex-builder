import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GrexSecurityError } from "../theme/assets/grex.js";
import { BUILDER_BREAKPOINTS, createBuilderStore } from "../theme/assets/store.js";
import { getNodeGrexClasses } from "../theme/assets/schema.js";
import { mountBuilderStudio } from "../theme/assets/studio.js";
import { mountPreviewHost } from "../theme/assets/preview-bridge.js";
import { createTestEnv } from "./helpers/dom-shim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const ELEMENTS_DOC = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "theme", "grex.elements.json"), "utf8")
);

test("v0.2 Theme Token Editor compiles Light/Dark modes and emits GREX-A11Y-001 contrast warnings", () => {
  const store = createBuilderStore(ELEMENTS_DOC);

  // Default tokens should have zero contrast warnings
  assert.equal(store.contrastWarnings.get().length, 0);

  // Focus ring cannot be removed or set to empty
  assert.throws(
    () => store.setThemeToken("base", "--grex-focus-ring", ""),
    GrexSecurityError
  );

  // Set low-contrast text color in light mode -> triggers GREX-A11Y-001 warning
  store.setThemeToken("light", "--grex-color-text", "#94a3b8");
  const warns = store.contrastWarnings.get();
  assert.ok(warns.some((w) => w.code === "GREX-A11Y-001" && w.mode === "light" && w.ratio < 4.5));

  // Compiled CSS includes :root, [data-grex-theme="light"], [data-grex-theme="dark"], and :focus-visible
  const css = store.compiledCss.get();
  assert.match(css.tokensCss, /:root\s*\{/);
  assert.match(css.tokensCss, /\[data-grex-theme="light"\]/);
  assert.match(css.tokensCss, /\[data-grex-theme="dark"\]/);
  assert.match(css.tokensCss, /--grex-color-text:\s*#94a3b8;/);

  // Undo restores clean contrast and removes warning
  assert.equal(store.undo(), true);
  assert.equal(store.contrastWarnings.get().length, 0);

  // Redo reapplies low-contrast token and warning
  assert.equal(store.redo(), true);
  assert.ok(store.contrastWarnings.get().some((w) => w.code === "GREX-A11Y-001"));
});

test("v0.2 Bricks-Style Reusable Class Manager creates, renames, duplicates, assigns, and undoes/redoes across slots", () => {
  const store = createBuilderStore(ELEMENTS_DOC);

  // Create class on selected home node
  store.createClass("hero-card", { base: { padding: "2rem", "border-radius": "0.75rem" } }, true);
  assert.ok("hero-card" in store.classRegistry.get());
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["hero-card"]);

  // Attach same class to a node in the `single` slot
  store.selectSlot("single");
  const singleRootId = store.selectedNodeId.get();
  store.assignClass(singleRootId, "hero-card", true);
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["hero-card"]);

  // Rename class -> updates classRegistry AND both `home` and `single` slots
  store.renameClass("hero-card", "feature-card");
  assert.ok(!("hero-card" in store.classRegistry.get()));
  assert.ok("feature-card" in store.classRegistry.get());
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["feature-card"]);

  store.selectSlot("home");
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["feature-card"]);
  assert.match(store.compiledCss.get().classesCss, /\.grex-c-feature-card\s*\{/);

  // Undo rename -> restores `hero-card` in both slots
  assert.equal(store.undo(), true);
  assert.ok("hero-card" in store.classRegistry.get());
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["hero-card"]);
  store.selectSlot("single");
  assert.deepEqual(getNodeGrexClasses(store.selectedNode.get()), ["hero-card"]);

  // Redo rename -> restores `feature-card`
  assert.equal(store.redo(), true);
  assert.ok("feature-card" in store.classRegistry.get());

  // Duplicate & delete class with full undo/redo parity
  store.duplicateClass("feature-card", "feature-card-alt", true);
  assert.ok("feature-card-alt" in store.classRegistry.get());
  store.deleteClass("feature-card-alt");
  assert.ok(!("feature-card-alt" in store.classRegistry.get()));
  assert.equal(store.undo(), true);
  assert.ok("feature-card-alt" in store.classRegistry.get());
});

test("v0.2 Multi-Breakpoint CSS compilation & undo/redo parity across Desktop, Tablet, and Mobile", () => {
  assert.equal(BUILDER_BREAKPOINTS.base, null);
  assert.equal(BUILDER_BREAKPOINTS.tablet, "(max-width: 1024px)");
  assert.equal(BUILDER_BREAKPOINTS.mobile, "(max-width: 767px)");

  const store = createBuilderStore(ELEMENTS_DOC);
  store.createClass("grid-shell", {}, true);

  store.setBreakpoint("base");
  store.setBreakpointStyle({ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "2rem" });

  store.setBreakpoint("tablet");
  store.setBreakpointStyle({ "grid-template-columns": "1fr 1fr", gap: "1.5rem" });

  store.setBreakpoint("mobile");
  store.setBreakpointStyle({ "grid-template-columns": "1fr", padding: "1rem" });

  const cssBeforeUndo = store.compiledCss.get().builderCss;
  assert.match(cssBeforeUndo, /\.grex-c-grid-shell\s*\{[\s\S]*display:\s*grid;/);
  assert.match(cssBeforeUndo, /@media \(max-width: 1024px\)\s*\{[\s\S]*\.grex-c-grid-shell/);
  assert.match(cssBeforeUndo, /@media \(max-width: 767px\)\s*\{[\s\S]*\.grex-c-grid-shell/);

  // Undo mobile style -> @media (max-width: 767px) disappears for grid-shell
  assert.equal(store.undo(), true);
  const cssAfterUndo = store.compiledCss.get().builderCss;
  assert.doesNotMatch(cssAfterUndo, /@media \(max-width: 767px\)\s*\{[\s\S]*\.grex-c-grid-shell/);

  // Redo mobile style -> exact CSS restored
  assert.equal(store.redo(), true);
  assert.equal(store.compiledCss.get().builderCss, cssBeforeUndo);

  // Exported document includes theme & classes
  const exported = store.exportDocument();
  assert.ok(exported.theme && exported.theme.tokens);
  assert.ok(exported.classes && exported.classes["grid-shell"]);
});

test("v0.2 Studio Breakpoint Switcher, Theme Mode & Live Class Style Sync with Zero <div> Elements", () => {
  const studioDom = createTestEnv();
  const previewDom = createTestEnv();

  const studioRoot = studioDom.document.createElement("section");
  studioDom.body.appendChild(studioRoot);
  const previewRoot = previewDom.document.createElement("section");
  previewDom.body.appendChild(previewRoot);

  const store = createBuilderStore(ELEMENTS_DOC);
  const previewHost = mountPreviewHost({
    allowedOrigins: ["http://127.0.0.1:8080"],
    targetWindow: previewDom.window,
    root: previewRoot,
    document: previewDom.document,
    initialSlots: store.documentTree.peek(),
    initialSlot: "home",
  });

  const studio = mountBuilderStudio({
    root: studioRoot,
    document: studioDom.document,
    store,
    previewOrigin: "http://127.0.0.1:8080",
    transport: {
      async saveDraft() { return { ok: true }; },
      async publish() { return { ok: true }; },
    },
  });

  studio.previewFrame.contentWindow = {
    postMessage(msg) {
      previewHost.handleMessage({
        origin: "http://127.0.0.1:8080",
        data: msg,
      });
    },
  };

  // Switch breakpoints via toolbar buttons
  const tabletBtn = studioRoot.querySelector('button[data-breakpoint="tablet"]');
  tabletBtn.dispatchEvent({ type: "click" });
  assert.equal(store.activeBreakpoint.get(), "tablet");
  assert.equal(studio.previewFrame.style.width, "768px");

  const mobileBtn = studioRoot.querySelector('button[data-breakpoint="mobile"]');
  mobileBtn.dispatchEvent({ type: "click" });
  assert.equal(store.activeBreakpoint.get(), "mobile");
  assert.equal(studio.previewFrame.style.width, "375px");

  // Toggle dark mode -> updates preview document data-grex-theme="dark"
  const modeBtn = studioRoot.querySelector("#studio-theme-mode-btn");
  modeBtn.dispatchEvent({ type: "click" });
  assert.equal(store.activeThemeMode.get(), "dark");
  assert.equal(previewDom.document.documentElement.getAttribute("data-grex-theme"), "dark");

  // Create class & set style -> live <style id="grex-live-classes"> updates in preview DOM
  store.createClass("v02-banner", { base: { padding: "1.5rem" } }, true);
  const liveClassesStyle = previewDom.document.getElementById("grex-live-classes");
  assert.ok(liveClassesStyle);
  assert.match(liveClassesStyle.textContent, /\.grex-c-v02-banner/);

  // Zero <div> elements in both studio and preview DOM
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);

  studio.dispose();
  previewHost.dispose();
});
