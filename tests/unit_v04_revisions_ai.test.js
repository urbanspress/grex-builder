import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GrexSecurityError, PREVIEW_CHANNEL } from "../theme/assets/grex.js";
import { createBuilderStore } from "../theme/assets/store.js";
import { mountBuilderStudio } from "../theme/assets/studio.js";
import { mountPreviewHost } from "../theme/assets/preview-bridge.js";
import {
  canonicalizeJson,
  sha256HexSync,
  buildRevisionSnapshot,
  computeSnapshotHash,
  computeRevisionDiff,
  snapshotToDocument,
} from "../theme/assets/revisions.js";
import {
  generateDesignSystemMarkdown,
  validateAiLayoutPayload,
} from "../theme/assets/design-system.js";
import { createTestEnv } from "./helpers/dom-shim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDefaultDoc() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "theme", "grex.elements.json"), "utf8"));
  return createBuilderStore(raw).exportDocument();
}

test("revisions.js produces canonical SHA-256 hashes, structured diffs, and GrabLab documents", () => {
  const docA = loadDefaultDoc();
  const docB = structuredClone(docA);

  // Re-order keys in docB — canonical hash must remain identical
  const reversedTemplates = {};
  for (const k of Object.keys(docB.templates).reverse()) {
    reversedTemplates[k] = docB.templates[k];
  }
  docB.templates = reversedTemplates;

  const hashA = computeSnapshotHash(docA);
  const hashB = computeSnapshotHash(docB);
  assert.equal(hashA.length, 64);
  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashB);

  // Empty object SHA-256 matches FIPS 180-4 test vector
  assert.equal(
    sha256HexSync("{}"),
    "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  );
  assert.equal(canonicalizeJson({ b: 2, a: 1 }), '{"a":1,"b":2}');

  // Modify tokens, classes, conditional rules, and template copy in target snapshot
  const modified = structuredClone(docA);
  modified.theme.tokens["--grex-color-primary"] = "#1d4ed8";
  modified.classes = modified.classes || {};
  modified.classes[".grex-c-hero-card"] = {
    label: "Hero Card",
    base: { padding: "2.5rem" },
  };
  modified.classes[".grex-c-badge-pill"] = {
    label: "Badge Pill",
    base: { borderRadius: "9999px" },
  };
  modified.templateRegistry.push({
    id: "landing-promo",
    label: "Landing Promo",
    slot: "home",
    priority: 15,
    enabled: true,
    conditions: [{ type: "url_path", operator: "include", value: "/promo" }],
  });
  modified.templates.home.children[1].children[0].children[0].props.text = "Restored Hero Copy";

  const diff = computeRevisionDiff(modified, docA);
  assert.ok(diff.templates.modified.includes("home"));
  assert.ok(diff.conditional_rules.added.includes("landing-promo"));
  assert.ok(
    diff.theme_tokens.changed.some(
      (entry) =>
        entry.token === "--grex-color-primary" &&
        entry.to === "#1d4ed8" &&
        entry.from !== "#1d4ed8"
    )
  );
  assert.ok(diff.class_registry.added.includes(".grex-c-hero-card"));
  assert.ok(diff.class_registry.added.includes(".grex-c-badge-pill"));
  assert.ok(diff.summary.totalChanges >= 5);

  const restoredDoc = snapshotToDocument(buildRevisionSnapshot(modified));
  assert.equal(restoredDoc.schemaVersion, "1.0.0");
  assert.equal(restoredDoc.theme.tokens["--grex-color-primary"], "#1d4ed8");
  assert.ok(Array.isArray(restoredDoc.templateRegistry));
});

test("design-system.js generates deterministic GRAB-DESIGN-SYSTEM.md from store state", () => {
  const doc = loadDefaultDoc();
  const store = createBuilderStore(doc);

  const md1 = store.designSystemMarkdown.get();
  const md2 = generateDesignSystemMarkdown(store.exportDocument(), { version: "0.4.0" });

  assert.ok(md1.includes("# GRAB-DESIGN-SYSTEM.md"));
  assert.ok(md1.includes("## 1. Active `--grex-*` Design Tokens"));
  assert.ok(md1.includes("--grex-color-primary"));
  assert.ok(md1.includes("## 3. Approved `grex.elements.json` Patterns & Semantic Rules"));
  assert.ok(md1.includes("`Text`"));
  assert.ok(md1.includes("`Section`"));
  assert.ok(md1.includes("## 4. Conditional Template Slots & Reusable Parts"));
  assert.ok(md2.includes("v0.4.0"));

  // Token and class updates update computed Markdown reactively
  store.setThemeToken("base", "--grex-color-primary", "#0f766e");
  store.createClass("ai-card", { base: { padding: "1.5rem" } }, false);
  const mdUpdated = store.designSystemMarkdown.get();
  assert.ok(mdUpdated.includes("#0f766e"));
  assert.ok(mdUpdated.includes("ai-card"));
});

test("AI guardrail rejects invalid tags, XSS, depth > 24, low contrast, and missing Image alt without mutating store", () => {
  const doc = loadDefaultDoc();
  const store = createBuilderStore(doc);
  const initialHomeJson = JSON.stringify(store.documentTree.get().home);

  // 1. Forbidden wrapper <div>
  const divRes = store.applyAiLayout({
    slot: "home",
    summary: "Bad div wrapper",
    tree: { element: "div", tag: "div", props: { id: "bad-div" }, children: [] },
  });
  assert.equal(divRes.ok, false);
  assert.equal(divRes.status, 422);
  assert.equal(divRes.mcpCode, -32602);
  assert.equal(JSON.stringify(store.documentTree.get().home), initialHomeJson);
  assert.equal(store.canUndo.get(), false);

  // 2. Forbidden <script> / event handlers / javascript: href
  const xssRes = validateAiLayoutPayload({
    slot: "home",
    tree: {
      element: "Container",
      tag: "section",
      props: { id: "xss-sec", onclick: "alert(1)" },
      children: [
        {
          element: "Button",
          props: { id: "xss-btn", text: "Click", href: "javascript:alert(1)" },
          children: [],
        },
      ],
    },
  });
  assert.equal(xssRes.ok, false);
  assert.equal(xssRes.status, 422);

  // 3. Depth > 24
  let deep = { element: "Text", tag: "p", props: { id: "leaf-txt", text: "leaf" }, children: [] };
  for (let i = 0; i < 26; i += 1) {
    deep = { element: "Container", tag: "section", props: { id: `d-${i}` }, children: [deep] };
  }
  const depthRes = store.applyAiLayout({ slot: "home", tree: deep });
  assert.equal(depthRes.ok, false);
  assert.equal(depthRes.status, 422);

  // 4. WCAG AA contrast failure (< 4.5:1)
  const lowContrastRes = store.applyAiLayout({
    slot: "home",
    tree: {
      element: "Container",
      tag: "main",
      props: { id: "lc-main" },
      children: [
        {
          element: "Text",
          tag: "p",
          props: { id: "lc-txt", text: "Too faint to read" },
          styles: { base: { color: "#9ca3af", "background-color": "#ffffff" } },
          children: [],
        },
      ],
    },
  });
  assert.equal(lowContrastRes.ok, false);
  assert.equal(lowContrastRes.status, 422);
  assert.ok(lowContrastRes.issues.some((e) => e.code === "GREX-A11Y-001"));

  // 5. Image missing alt (unless decorative: true)
  const missingAltRes = store.applyAiLayout({
    slot: "home",
    tree: {
      element: "Container",
      tag: "main",
      props: { id: "img-main" },
      children: [
        {
          element: "Image",
          props: { id: "img-no-alt", src: "/static/grex/hero.png" },
          children: [],
        },
      ],
    },
  });
  assert.equal(missingAltRes.ok, false);
  assert.equal(missingAltRes.status, 422);
  assert.ok(missingAltRes.issues.some((e) => e.code === "GREX-A11Y-002"));

  // Store remains completely clean after 5 rejections
  assert.equal(JSON.stringify(store.documentTree.get().home), initialHomeJson);
  assert.equal(store.history.get().undoStack.length, 0);
});

test("applyAiLayout commits valid WCAG-compliant AI layout through CommandStack (actor: groxy-ai) with 1-click Undo/Redo", () => {
  const doc = loadDefaultDoc();
  const store = createBuilderStore(doc);
  const originalHome = structuredClone(store.documentTree.get().home);

  const aiTree = {
    element: "Container",
    tag: "main",
    props: { id: "ai-main" },
    styles: { base: { "background-color": "#ffffff", color: "#0f172a" } },
    children: [
      {
        element: "Heading",
        props: { id: "ai-h1", level: 1, text: "AI Authored Hero Section" },
        styles: { base: { color: "#0f172a", "background-color": "#ffffff" } },
        children: [],
      },
      {
        element: "Image",
        props: {
          id: "ai-hero-img",
          src: "/static/grex/banner.png",
          alt: "Accessible product showcase",
        },
        children: [],
      },
    ],
  };

  const res = store.applyAiLayout({
    slot: "home",
    summary: "Replaced home hero via MCP",
    tree: aiTree,
  });

  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.actor, "groxy-ai");
  assert.equal(store.lastAiActorNotice.get()?.actor, "groxy-ai");
  assert.equal(store.documentTree.get().home.children[0].props.text, "AI Authored Hero Section");

  const undoStack = store.history.get().undoStack;
  assert.equal(undoStack.length, 1);
  assert.equal(undoStack[0].actor, "groxy-ai");
  assert.equal(undoStack[0].command.type, "applyAiLayout");

  // 1-click Ctrl+Z undo restores original tree cleanly
  assert.equal(store.canUndo.get(), true);
  store.undo();
  assert.equal(
    JSON.stringify(store.documentTree.get().home),
    JSON.stringify(originalHome)
  );

  // Redo reapplies AI tree
  store.redo();
  assert.equal(store.documentTree.get().home.children[0].props.text, "AI Authored Hero Section");
});

test("Revisions Drawer + GrexPreviewBridge live historical preview & 1-click restore preserve zero wrapper <div>s", async () => {
  const { document, body } = createTestEnv();
  const studioRoot = document.createElement("section");
  studioRoot.id = "grex-studio-root";
  body.appendChild(studioRoot);

  const previewEnv = createTestEnv();
  const previewRoot = previewEnv.document.createElement("section");
  previewRoot.id = "grex-preview-root";
  previewEnv.body.appendChild(previewRoot);

  const currentDoc = loadDefaultDoc();
  const rev1Doc = structuredClone(currentDoc);
  rev1Doc.templates.home.children[1].children[0].children[0].props.text = "Revision 1 Launch Banner";
  const rev1Snap = buildRevisionSnapshot(rev1Doc);

  const rev2Doc = structuredClone(currentDoc);
  rev2Doc.templates.home.children[1].children[0].children[0].props.text = "Revision 2 Summer Banner";
  const rev2Snap = buildRevisionSnapshot(rev2Doc);

  const store = createBuilderStore(currentDoc);
  store.revisions.set([
    {
      id: 2,
      revision_number: 2,
      author: "designer",
      summary: "Summer campaign update",
      content_hash: computeSnapshotHash(rev2Doc),
      created_at: "2026-11-14T16:00:00Z",
    },
    {
      id: 1,
      revision_number: 1,
      author: "designer",
      summary: "Initial launch publish",
      content_hash: computeSnapshotHash(rev1Doc),
      created_at: "2026-11-14T15:00:00Z",
    },
  ]);

  let restoreCalls = 0;
  const mockTransport = {
    async saveDraft() {
      return { ok: true };
    },
    async publish() {
      return { ok: true, data: { live_epoch: "rev-2" } };
    },
    async listRevisions() {
      return { ok: true, revisions: store.revisions.peek() };
    },
    async getRevision(id) {
      const numId = Number(id);
      const snap = numId === 1 ? rev1Snap : rev2Snap;
      return {
        ok: true,
        revision: store.revisions.peek().find((r) => r.id === numId),
        snapshot: snap,
        diff: store.computeDiffAgainstCurrent(snap),
      };
    },
    async restoreRevision(id) {
      restoreCalls += 1;
      const rev3 = {
        id: 3,
        revision_number: 3,
        author: "designer",
        summary: `Restored from Revision #${id}`,
        parent_revision_id: Number(id),
        content_hash: computeSnapshotHash(rev1Doc),
        created_at: "2026-11-14T17:00:00Z",
      };
      return {
        ok: true,
        live_epoch: "rev-3",
        revision: rev3,
        document: rev1Doc,
      };
    },
  };

  const bridgeErrors = [];
  const host = mountPreviewHost({
    allowedOrigins: ["http://127.0.0.1:8080"],
    targetWindow: previewEnv.window,
    root: previewRoot,
    document: previewEnv.document,
    initialSlots: store.documentTree.peek(),
    initialSlot: "home",
    onError: (err) => bridgeErrors.push(err),
  });

  // Verify untrusted origin previewRevision fails closed via GrexSecurityError
  const rejected = host.handleMessage({
    origin: "https://evil.example",
    data: {
      channel: PREVIEW_CHANNEL,
      type: "previewRevision",
      snapshot: rev1Snap,
      slot: "home",
    },
  });
  assert.equal(rejected, false);
  assert.equal(bridgeErrors.length, 1);
  assert.ok(bridgeErrors[0] instanceof GrexSecurityError);

  const studio = mountBuilderStudio({
    root: studioRoot,
    document,
    store,
    previewOrigin: "http://127.0.0.1:8080",
    transport: mockTransport,
  });

  // Wire iframe contentWindow.postMessage to the preview host window
  studio.previewFrame.contentWindow.postMessage = (msg, targetOrigin) => {
    host.handleMessage({ origin: targetOrigin, data: msg });
  };

  // Zero <div> elements in initial studio + preview DOM
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);

  // Open Revisions drawer
  const revBtn = studioRoot.querySelector("#studio-revisions-btn");
  assert.ok(revBtn);
  revBtn.dispatchEvent({ type: "click" });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(revBtn.getAttribute("aria-expanded"), "true");
  assert.equal(studio.revisionsDrawer.hidden, false);

  // Select Revision #1 in timeline
  const rev1Row = studioRoot.querySelector('[data-revision-id="1"]');
  const rev1ItemBtn = rev1Row?.querySelector("button");
  assert.ok(rev1ItemBtn);
  rev1ItemBtn.dispatchEvent({ type: "click" });

  // Wait microtasks for async inspectRevision()
  await new Promise((r) => setTimeout(r, 20));
  assert.match(studioRoot.querySelector("#grex-revision-diff").textContent, /~ Template\/Part: home/);

  // Preview Revision #1 live in preview bridge WITHOUT altering live documentTree
  const liveBefore = store.documentTree.get().home.children[1].children[0].children[0].props.text;
  const prevBtn = studioRoot.querySelector("#studio-preview-revision-btn");
  prevBtn.dispatchEvent({ type: "click" });
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(store.activeRevisionPreview.get()?.revision?.id, 1);
  assert.equal(
    store.documentTree.get().home.children[1].children[0].children[0].props.text,
    liveBefore
  );
  assert.match(previewRoot.textContent, /Revision 1 Launch Banner/);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);

  // Open confirmation dialog and execute 1-click Restore
  studioRoot.querySelector("#studio-restore-revision-btn").dispatchEvent({ type: "click" });
  assert.equal(studio.restoreDialog.open, true);

  studioRoot.querySelector("#studio-confirm-restore-btn").dispatchEvent({ type: "click" });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(studio.restoreDialog.open, false);

  assert.equal(restoreCalls, 1);
  assert.equal(
    store.documentTree.get().home.children[1].children[0].children[0].props.text,
    "Revision 1 Launch Banner"
  );
  assert.equal(store.activeRevisionPreview.get(), null);
  assert.equal(store.revisions.get()[0].revision_number, 3);
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);

  studio.dispose();
  host.dispose();
});
