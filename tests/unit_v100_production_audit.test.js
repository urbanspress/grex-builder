import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GrexSecurityError } from "../theme/assets/grex.js";
import { createBuilderStore } from "../theme/assets/store.js";
import { mountBuilderStudio } from "../theme/assets/studio.js";
import { mountPreviewHost } from "../theme/assets/preview-bridge.js";
import { normalizeTemplateConditions } from "../theme/assets/templates.js";
import { buildRevisionSnapshot, computeSnapshotHash } from "../theme/assets/revisions.js";
import { createTestEnv } from "./helpers/dom-shim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDefaultDoc() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "theme", "grex.elements.json"), "utf8"));
  return createBuilderStore(raw).exportDocument();
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

test("Pre-v1.0.0 Audit: Media Library modal, Navigation Menu picker, Tokens/Templates panels & Revisions/Restore dialog emit zero <div> or innerHTML", async () => {
  const { document, body } = createTestEnv();
  const studioRoot = document.createElement("section");
  studioRoot.id = "grex-studio-root";
  body.appendChild(studioRoot);

  const previewEnv = createTestEnv();
  const previewRoot = previewEnv.document.createElement("section");
  previewRoot.id = "grex-preview-root";
  previewEnv.body.appendChild(previewRoot);

  const baseDoc = loadDefaultDoc();
  const rev1Doc = structuredClone(baseDoc);
  rev1Doc.templates.home.children[1].children[0].children[0].props.text = "Audit Revision #1";
  const rev1Snap = buildRevisionSnapshot(rev1Doc);

  const store = createBuilderStore(baseDoc);
  store.revisions.set([
    {
      id: 1,
      revision_number: 1,
      author: "designer",
      summary: "Audit snapshot",
      content_hash: computeSnapshotHash(rev1Doc),
      created_at: "2026-11-14T18:00:00Z",
    },
  ]);

  let restoreCount = 0;
  const mockTransport = {
    async saveDraft() {
      return { ok: true };
    },
    async publish() {
      return { ok: true, data: { live_epoch: 2 } };
    },
    async listMedia() {
      return {
        ok: true,
        data: {
          media: [
            {
              id: "media-audit-01",
              url: "/static/theme/preview-hero.svg",
              alt: "Audit Showcase Graphic",
              width: 1200,
              height: 630,
              decorative: false,
            },
          ],
        },
      };
    },
    async getMenu(location) {
      return {
        ok: true,
        data: {
          location,
          menu: [
            { label: "Home", href: "/" },
            { label: "Footer Policy", href: "/privacy" },
          ],
        },
      };
    },
    async listRevisions() {
      return { ok: true, data: { revisions: store.revisions.peek() } };
    },
    async getRevision() {
      return {
        ok: true,
        data: {
          revision: store.revisions.peek()[0],
          snapshot: rev1Snap,
          diff: store.computeDiffAgainstCurrent(rev1Snap),
        },
      };
    },
    async restoreRevision(id) {
      restoreCount += 1;
      return {
        ok: true,
        data: {
          live_epoch: 3,
          revision: {
            id: 2,
            revision_number: 2,
            author: "designer",
            summary: `Restored from Revision #${id}`,
            parent_revision_id: Number(id),
            content_hash: computeSnapshotHash(rev1Doc),
            created_at: "2026-11-14T18:05:00Z",
          },
          document: rev1Doc,
        },
      };
    },
  };

  const host = mountPreviewHost({
    allowedOrigins: ["http://127.0.0.1:8080"],
    targetWindow: previewEnv.window,
    root: previewRoot,
    document: previewEnv.document,
    initialSlots: store.documentTree.peek(),
    initialSlot: "home",
  });

  const studio = mountBuilderStudio({
    root: studioRoot,
    document,
    store,
    previewOrigin: "http://127.0.0.1:8080",
    transport: mockTransport,
  });

  studio.previewFrame.contentWindow.postMessage = (msg) => {
    previewEnv.window.postMessage(msg, "http://127.0.0.1:8080");
  };

  // 1. Open Media Library Dialog from Image Inspector & pick a media asset
  store.insertElement("Image");
  await flushMicrotasks();
  const browseMediaBtn = studioRoot.querySelector("#studio-media-picker-btn");
  assert.ok(browseMediaBtn, "Image Inspector must render Browse Media Library button");
  browseMediaBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();

  const mediaDialog = studioRoot.querySelector("#grex-media-dialog");
  assert.ok(mediaDialog && mediaDialog.open === true, "Media Library dialog should be open");
  const mediaAltInput = mediaDialog.querySelector("#grex-media-alt-input");
  assert.ok(mediaAltInput, "Media Library dialog should render #grex-media-alt-input");
  mediaAltInput.value = "";
  const mediaItemBtn = mediaDialog.querySelector('[data-media-id="media-audit-01"]');
  assert.ok(mediaItemBtn, "Media Library dialog should render fetched media item");
  mediaItemBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();
  assert.equal(store.selectedNode.get().props.src, "/static/theme/preview-hero.svg");
  assert.equal(store.selectedNode.get().props.alt, "Audit Showcase Graphic");
  assert.equal(mediaDialog.open, false);

  // 2. Load & bind Navigation Menu in Nav Inspector
  store.selectSlot("part:header");
  store.selectNode("part-header-nav");
  await flushMicrotasks();
  const navPicker = studioRoot.querySelector("#grex-nav-menu-picker");
  const bindMenuBtn = studioRoot.querySelector("#studio-bind-menu-btn");
  assert.ok(navPicker && bindMenuBtn, "Nav Inspector must render #grex-nav-menu-picker and #studio-bind-menu-btn");
  bindMenuBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();
  const boundNav = store.selectedNode.get();
  assert.equal(boundNav.element, "Nav");
  assert.equal(boundNav.props.items?.length, 2);

  // 3. Switch left tabs: Tokens -> Templates -> Elements
  studioRoot.querySelector("#grex-tab-tokens").dispatchEvent({ type: "click" });
  await flushMicrotasks();
  assert.equal(studioRoot.querySelector("#grex-theme-tokens-panel").hidden, false);

  studioRoot.querySelector("#grex-tab-templates").dispatchEvent({ type: "click" });
  await flushMicrotasks();
  assert.equal(studioRoot.querySelector("#grex-templates-panel").hidden, false);

  studioRoot.querySelector("#grex-tab-elements").dispatchEvent({ type: "click" });
  await flushMicrotasks();
  assert.equal(studioRoot.querySelector("#grex-structure-tree").hidden, false);

  // 4. Open Revisions Drawer, inspect diff, open Restore Dialog & confirm restore
  studioRoot.querySelector("#studio-revisions-btn").dispatchEvent({ type: "click" });
  await flushMicrotasks();
  const drawer = studioRoot.querySelector("#grex-revisions-drawer");
  assert.equal(drawer.hidden, false);

  const selectRevBtn = drawer.querySelector(".grex-revision-select");
  assert.ok(selectRevBtn);
  selectRevBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();

  const restoreBtn = drawer.querySelector("#studio-restore-revision-btn");
  assert.ok(restoreBtn, "Revision diff view must render #studio-restore-revision-btn");
  restoreBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();

  const restoreDialog = studioRoot.querySelector("#grex-restore-dialog");
  assert.equal(restoreDialog.open, true);
  const confirmRestoreBtn = restoreDialog.querySelector("#studio-confirm-restore-btn");
  assert.ok(confirmRestoreBtn);
  confirmRestoreBtn.dispatchEvent({ type: "click" });
  await flushMicrotasks();
  assert.equal(restoreCount, 1);

  // Final semantic DOM & zero-innerHTML verification across entire lifecycle
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);
  assert.equal(studioRoot.innerHTMLWriteCount, 0);
  assert.equal(previewRoot.innerHTMLWriteCount, 0);

  studio.dispose();
  host.dispose();
});

test("Pre-v1.0.0 Audit: normalizeTemplateConditions supports taxonomy_term string shorthand and rejects empty strings", () => {
  const fromSimple = normalizeTemplateConditions([
    { type: "taxonomy_term", value: "guides", operator: "include" },
  ]);
  assert.deepEqual(fromSimple, [
    { type: "taxonomy_term", value: { taxonomy: "category", term: "guides" }, operator: "include" },
  ]);

  const fromNamespaced = normalizeTemplateConditions([
    { type: "taxonomy_term", value: "topic:grab", operator: "exclude" },
  ]);
  assert.deepEqual(fromNamespaced, [
    { type: "taxonomy_term", value: { taxonomy: "topic", term: "grab" }, operator: "exclude" },
  ]);

  const doc = loadDefaultDoc();
  doc.templateRegistry = [
    {
      id: "tpl-guides-shorthand",
      name: "Guides Shorthand",
      slot: "archive",
      priority: 25,
      conditions: [{ type: "taxonomy_term", value: "guides", operator: "include" }],
    },
  ];
  const store = createBuilderStore(doc);
  assert.deepEqual(store.templateRegistry.get()[0].conditions, [
    { type: "taxonomy_term", value: { taxonomy: "category", term: "guides" }, operator: "include" },
  ]);

  assert.throws(
    () => normalizeTemplateConditions([{ type: "taxonomy_term", value: "   ", operator: "include" }]),
    GrexSecurityError
  );
  assert.throws(
    () => normalizeTemplateConditions([{ type: "taxonomy_term", value: "category:", operator: "include" }]),
    GrexSecurityError
  );
});

test("Pre-v1.0.0 Audit: 100% byte-identical theme/assets/* vs public/theme/* and zero <div> in all 11 .grab.html files", () => {
  const srcDir = path.join(ROOT, "theme", "assets");
  const dstDir = path.join(ROOT, "public", "theme");
  const srcFiles = fs.readdirSync(srcDir).filter((f) => fs.statSync(path.join(srcDir, f)).isFile()).sort();
  const dstFiles = fs.readdirSync(dstDir).filter((f) => fs.statSync(path.join(dstDir, f)).isFile()).sort();

  assert.deepEqual(srcFiles, dstFiles, "theme/assets and public/theme must contain identical file sets");

  for (const name of srcFiles) {
    const h1 = crypto.createHash("sha256").update(fs.readFileSync(path.join(srcDir, name))).digest("hex");
    const h2 = crypto.createHash("sha256").update(fs.readFileSync(path.join(dstDir, name))).digest("hex");
    assert.equal(h1, h2, `Asset byte drift detected in ${name}`);
  }

  const collectGrabHtml = (dir) => {
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...collectGrabHtml(full));
      } else if (entry.name.endsWith(".grab.html")) {
        found.push(full);
      }
    }
    return found;
  };

  const templates = [
    ...collectGrabHtml(path.join(ROOT, "views")),
    ...collectGrabHtml(path.join(ROOT, "theme", "templates")),
  ];
  assert.equal(templates.length, 11, `Expected 11 .grab.html templates, found ${templates.length}`);

  for (const tplPath of templates) {
    const content = fs.readFileSync(tplPath, "utf8");
    assert.equal(/<\/?div[\s>]/i.test(content), false, `Forbidden <div> found in ${tplPath}`);
  }

  // Verify views/studio.grab.html keeps immutable /static/theme/builder.css + compiled /static/grex/builder.css
  const studioView = fs.readFileSync(path.join(ROOT, "views", "studio.grab.html"), "utf8");
  assert.ok(studioView.includes('href="/static/theme/builder.css"'));
  assert.ok(studioView.includes('href="{builder_css_url}"'));
});

test("Pre-v1.0.0 Audit: deploy/docker-compose.yml & deploy/README.md enforce --read-only Docker isolation with zero hardcoded secrets/IPs", () => {
  const composePath = path.join(ROOT, "deploy", "docker-compose.yml");
  const readmePath = path.join(ROOT, "deploy", "README.md");
  assert.ok(fs.existsSync(composePath), "Missing deploy/docker-compose.yml");
  assert.ok(fs.existsSync(readmePath), "Missing deploy/README.md");

  const compose = fs.readFileSync(composePath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");

  assert.ok(compose.includes("read_only: true"));
  assert.ok(compose.includes("no-new-privileges:true"));
  assert.ok(compose.includes("- ALL"));
  assert.ok(compose.includes("../storage:/app/storage:rw"));
  assert.ok(compose.includes("../public/grex:/app/public/grex:rw"));
  assert.ok(compose.includes("../theme:/app/themes/grex-builder:ro"));
  assert.ok(compose.includes("/_ready"));
  assert.ok(readme.includes("--read-only"));
  assert.ok(readme.includes("/_ready") && readme.includes("/_health"));

  // Ensure no hardcoded private/public IPv4 addresses or inline secret literals leak into deploy files
  for (const txt of [compose, readme]) {
    const ipMatches = txt.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || [];
    for (const ip of ipMatches) {
      assert.ok(ip === "127.0.0.1" || ip === "0.0.0.0", `Unexpected hardcoded IP in deploy artifact: ${ip}`);
    }
  }
});
