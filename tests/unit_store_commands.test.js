import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GrexSecurityError, effect } from "../theme/assets/grex.js";
import {
  ELEMENT_CATALOG,
  SUPPORTED_ELEMENT_TYPES,
  buildDefaultNodeForElement,
  evaluateSlotDiagnostics,
  getNodeId,
} from "../theme/assets/schema.js";
import { createBuilderStore } from "../theme/assets/store.js";
import { findNodeLocation } from "../theme/assets/commands.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadThemeManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "theme", "theme.json"), "utf8"));
}

function loadDefaultElementsDoc() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "theme", "grex.elements.json"), "utf8"));
}

test("theme.json & grex.elements.json satisfy exclusive mode:visual contract and pass WCAG AA", () => {
  const manifest = loadThemeManifest();
  assert.equal(manifest.schemaVersion, "1.0.0");
  assert.equal(manifest.slug, "grex-builder");
  assert.equal(manifest.mode, "visual");
  assert.equal(manifest.engine, "grex-visual");
  assert.ok(manifest.capabilities.includes("grex:visual"));
  assert.ok(Array.isArray(manifest.themeHooks));
  for (const slot of ["home", "single", "archive", "404", "search"]) {
    assert.ok(manifest.templates[slot], `Missing template slot ${slot}`);
  }

  const doc = loadDefaultElementsDoc();
  const store = createBuilderStore(doc);
  const fullDiag = store.fullDocumentDiagnostics.get();
  assert.equal(fullDiag.ok, true, JSON.stringify(fullDiag.errors));

  const exported = store.exportDocument();
  assert.ok(exported.templates.home);
  assert.ok(exported.parts.header);
  assert.equal(JSON.stringify(exported).includes('"tag":"div"'), false);
});

test("createBuilderStore runs on Grex JS signals and inserts/edits/undoes/redoes all 20 elements", () => {
  const doc = loadDefaultElementsDoc();
  const store = createBuilderStore(doc);

  let reportEvaluations = 0;
  const stop = effect(() => {
    store.validationReport.get();
    reportEvaluations += 1;
  });

  assert.equal(ELEMENT_CATALOG.elementCount, 20);
  assert.equal(SUPPORTED_ELEMENT_TYPES.length, 20);
  assert.equal(store.canUndo.get(), false);
  assert.equal(store.canRedo.get(), false);
  assert.equal(store.isDirty.get(), false);

  const insertedIds = [];
  for (const elType of SUPPORTED_ELEMENT_TYPES) {
    const node = store.insertElement(elType, "home-main");
    insertedIds.push(getNodeId(node));
  }

  assert.equal(insertedIds.length, 20);
  assert.equal(store.isDirty.get(), true);
  assert.equal(store.canUndo.get(), true);
  assert.ok(reportEvaluations >= 2);

  // Every inserted default element passes validateElementNode() + auditAccessibility()
  const diag = store.validationReport.get();
  assert.equal(diag.ok, true, JSON.stringify(diag.errors));

  // Move last inserted node to index 0 inside home-main
  const lastId = insertedIds[insertedIds.length - 1];
  store.moveElement(lastId, "home-main", 0);
  let homeMain = findNodeLocation(store.activeSlotTree.get(), "home-main").node;
  assert.equal(getNodeId(homeMain.children[0]), lastId);

  // Update props & styles
  const headingId = insertedIds[SUPPORTED_ELEMENT_TYPES.indexOf("Heading")];
  store.updateNodeProps(headingId, { text: "Updated Hero Heading", level: 3 }, { actor: "groxy-ai" });
  store.updateNodeStyles(headingId, {
    base: { color: "#0f172a", padding: "1rem" },
    mobile: { padding: "0.5rem" },
  });

  const updatedHeading = findNodeLocation(store.activeSlotTree.get(), headingId).node;
  assert.equal(updatedHeading.props.text, "Updated Hero Heading");
  assert.equal(updatedHeading.props.level, 3);
  assert.equal(updatedHeading.styles.base.color, "#0f172a");
  assert.equal(updatedHeading.styles.mobile.padding, "0.5rem");

  // Command stack is 100% JSON-serializable for Groxy AI parity
  const serializedHistory = JSON.parse(JSON.stringify(store.history.get()));
  assert.equal(serializedHistory.undoStack.length, 23);
  assert.equal(serializedHistory.undoStack[21].actor, "groxy-ai");

  // Undo style, prop, move, and all 20 inserts cleanly
  for (let i = 0; i < 23; i += 1) {
    assert.equal(store.undo(), true);
  }
  assert.equal(store.canUndo.get(), false);
  assert.equal(store.canRedo.get(), true);
  assert.equal(store.isDirty.get(), false);

  // Redo all 23 steps
  for (let i = 0; i < 23; i += 1) {
    assert.equal(store.redo(), true);
  }
  assert.equal(store.canRedo.get(), false);
  assert.equal(store.isDirty.get(), true);
  homeMain = findNodeLocation(store.activeSlotTree.get(), "home-main").node;
  assert.equal(getNodeId(homeMain.children[0]), lastId);

  // Delete node & undo delete restores exact position
  store.deleteElement(lastId);
  assert.equal(findNodeLocation(store.activeSlotTree.get(), lastId), null);
  assert.equal(store.undo(), true);
  homeMain = findNodeLocation(store.activeSlotTree.get(), "home-main").node;
  assert.equal(getNodeId(homeMain.children[0]), lastId);

  // replaceTree command + undo
  const prevHome = store.documentTree.get().home;
  store.replaceSlotTree("home", {
    id: "home-custom",
    element: "Section",
    tag: "main",
    props: { id: "home-custom", label: "Custom Main" },
    children: [
      { id: "custom-h1", element: "Heading", props: { id: "custom-h1", level: 1, text: "AI Scaffold" } },
    ],
  });
  assert.equal(store.activeSlotTree.get().id, "home-custom");
  assert.equal(store.undo(), true);
  assert.equal(store.activeSlotTree.get().id, prevHome.id);

  stop();
});

test("security validation rejects <div>, <script>, on* handlers, javascript: URLs, and depth > 24", () => {
  const store = createBuilderStore(loadDefaultElementsDoc());
  const baselineJson = JSON.stringify(store.documentTree.get());

  assert.throws(
    () =>
      store.dispatch({
        type: "insertNode",
        slot: "home",
        parentId: "home-main",
        node: { id: "bad-div", element: "Section", tag: "div", props: {} },
      }),
    GrexSecurityError
  );

  assert.throws(
    () =>
      store.dispatch({
        type: "insertNode",
        slot: "home",
        parentId: "home-main",
        node: { id: "bad-script", element: "Script", props: {} },
      }),
    GrexSecurityError
  );

  assert.throws(
    () =>
      store.dispatch({
        type: "insertNode",
        slot: "home",
        parentId: "home-main",
        node: { id: "bad-evt", element: "Button", props: { text: "X", onclick: "alert(1)" } },
      }),
    GrexSecurityError
  );

  assert.throws(
    () =>
      store.dispatch({
        type: "insertNode",
        slot: "home",
        parentId: "home-main",
        node: { id: "bad-url", element: "Link", props: { text: "Click", href: "javascript:alert(1)" } },
      }),
    GrexSecurityError
  );

  // Build nesting depth > 24
  let deep = { id: "leaf", element: "Text", props: { text: "Deep" } };
  for (let i = 0; i < 26; i += 1) {
    deep = { id: `wrap-${i}`, element: "Section", props: {}, children: [deep] };
  }
  assert.throws(
    () =>
      store.dispatch({
        type: "insertNode",
        slot: "home",
        parentId: "home-main",
        node: deep,
      }),
    GrexSecurityError
  );

  // Store state must remain completely untouched
  assert.equal(JSON.stringify(store.documentTree.get()), baselineJson);
  assert.equal(store.canUndo.get(), false);
});

test("Save Draft isolates changes while Publish enforces WCAG AA gate and compiles /static/grex/ CSS", async () => {
  const store = createBuilderStore(loadDefaultElementsDoc());
  const savedDrafts = [];
  const publishedPayloads = [];
  const transport = {
    async saveDraft(payload) {
      savedDrafts.push(payload);
      return { ok: true };
    },
    async publish(payload) {
      publishedPayloads.push(payload);
      return { ok: true };
    },
  };

  // Insert an Image with missing alt text -> should allow Draft save but BLOCK Publish
  const imgNode = buildDefaultNodeForElement("Image");
  imgNode.props.alt = "";
  imgNode.props.decorative = false;
  store.dispatch({
    type: "insertNode",
    slot: "home",
    parentId: "home-main",
    node: imgNode,
  });

  const draftRes = await store.saveDraft(transport);
  assert.equal(draftRes.ok, true);
  assert.equal(savedDrafts.length, 1);
  assert.equal(store.isDirty.get(), false);
  assert.equal(store.hasUnpublishedChanges.get(), true);
  assert.equal(store.saveStatus.get(), "saved");

  const blockedPub = await store.publish(transport);
  assert.equal(blockedPub.ok, false);
  assert.match(blockedPub.error, /GREX-A11Y-002/);
  assert.equal(publishedPayloads.length, 0);
  assert.equal(store.saveStatus.get(), "error");

  // Fix accessibility issue (provide descriptive alt text) + add responsive styles -> Publish succeeds
  store.updateNodeProps(imgNode.id, { alt: "Verified hero banner image" });
  store.updateNodeStyles("home-hero", {
    base: { padding: "2rem", backgroundColor: "#ffffff", color: "#0f172a" },
    mobile: { padding: "1rem" },
  });

  const pubRes = await store.publish(transport);
  assert.equal(pubRes.ok, true);
  assert.equal(publishedPayloads.length, 1);
  assert.equal(store.saveStatus.get(), "published");
  assert.equal(store.isDirty.get(), false);
  assert.equal(store.hasUnpublishedChanges.get(), false);
  assert.match(publishedPayloads[0].tokensCss, /:focus-visible/);
  assert.match(publishedPayloads[0].builderCss, /\.grex-el-home-hero/);
  assert.match(publishedPayloads[0].builderCss, /@media \(max-width: 767px\)/);

  // Confirm low-contrast color error also blocks publish
  store.updateNodeStyles("home-title", { base: { color: "#cbd5e1", backgroundColor: "#ffffff" } });
  const lowContrastDiag = evaluateSlotDiagnostics(store.activeSlotTree.get(), {});
  assert.equal(lowContrastDiag.ok, false);
  assert.ok(lowContrastDiag.errors.some((e) => e.code === "GREX-A11Y-001"));
});
