import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GrexSecurityError, PREVIEW_CHANNEL } from "../theme/assets/grex.js";
import { createBuilderStore } from "../theme/assets/store.js";
import { mountBuilderStudio } from "../theme/assets/studio.js";
import { mountPreviewHost, createStudioPreviewClient } from "../theme/assets/preview-bridge.js";
import { createTestEnv } from "./helpers/dom-shim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDefaultDoc() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "theme", "grex.elements.json"), "utf8"));
}

test("mountBuilderStudio renders 20-element palette, structure tree, inspector, and zero <div> elements", async () => {
  const { document, body } = createTestEnv();
  const studioRoot = document.createElement("section");
  studioRoot.id = "grex-studio-root";
  body.appendChild(studioRoot);

  const previewEnv = createTestEnv();
  const previewRoot = previewEnv.document.createElement("section");
  previewRoot.id = "grex-preview-root";
  previewEnv.body.appendChild(previewRoot);

  const store = createBuilderStore(loadDefaultDoc());
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
    transport: {
      async saveDraft() {
        return { ok: true };
      },
      async publish() {
        return { ok: true };
      },
    },
  });

  // Wire iframe contentWindow.postMessage to the preview host window
  studio.previewFrame.contentWindow.postMessage = (msg, origin) => {
    previewEnv.window.postMessage(msg, "http://127.0.0.1:8080");
  };

  // Zero wrapper <div> assertion on both studio UI and live preview DOM
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);

  // All 20 element buttons exist in the palette
  const paletteBtns = studioRoot.querySelectorAll(".grex-palette-item");
  assert.equal(paletteBtns.length, 20);

  // Click Button palette item -> inserts into Structure Tree & syncs preview DOM
  const buttonPaletteItem = studioRoot.querySelector('button[data-element-type="Button"]');
  buttonPaletteItem.dispatchEvent({ type: "click" });

  assert.equal(store.selectedNode.get().element, "Button");
  assert.ok(previewRoot.querySelector("button"), "Inserted Button should render in live preview iframe");

  // Edit Button text via Inspector input -> patches live preview text in browser memory
  const textInput = studioRoot
    .querySelectorAll('input[type="text"]')
    .find((el) => el.id && el.id.startsWith("prop-text-"));
  textInput.value = "Launch Studio";
  textInput.dispatchEvent({ type: "change" });
  assert.equal(store.selectedNode.get().props.text, "Launch Studio");
  assert.equal(previewRoot.querySelector("button").textContent, "Launch Studio");

  // Drag-and-drop Text element from palette onto home-hero row in Structure Tree
  const textPaletteItem = studioRoot.querySelector('button[data-element-type="Text"]');
  textPaletteItem.dispatchEvent({
    type: "dragstart",
    dataTransfer: { setData() {} },
  });
  const heroRow = studioRoot.querySelector('[data-node-id="home-hero"]');
  heroRow.dispatchEvent({
    type: "drop",
    preventDefault() {},
    dataTransfer: { getData: () => "Text" },
  });
  assert.equal(store.selectedNode.get().element, "Text");

  // Verify zero <div> elements even after mutations
  assert.equal(studioRoot.querySelectorAll("div").length, 0);
  assert.equal(previewRoot.querySelectorAll("div").length, 0);
  assert.equal(studioRoot.innerHTMLWriteCount, 0);
  assert.equal(previewRoot.innerHTMLWriteCount, 0);

  const insertedTextId = store.selectedNodeId.get();
  // Undo via toolbar button (removes dropped Text node; selection safely falls back to Fragment root)
  const undoBtn = studioRoot.querySelector('[data-grex-id="studio-undo-btn"]');
  undoBtn.dispatchEvent({ type: "click" });
  assert.equal(store.selectedNode.get().element, "Fragment");
  assert.equal(studioRoot.querySelector(`[data-node-id="${insertedTextId}"]`), null);
  assert.equal(previewRoot.querySelector("button").textContent, "Launch Studio");

  studio.dispose();
  host.dispose();
});

test("GrexPreviewBridge rejects wildcard/empty origins and untrusted message origins fail-closed", () => {
  const { document, window, body } = createTestEnv();
  const root = document.createElement("section");
  body.appendChild(root);

  const store = createBuilderStore(loadDefaultDoc());

  assert.throws(
    () =>
      mountPreviewHost({
        allowedOrigins: ["*"],
        targetWindow: window,
        root,
        document,
      }),
    GrexSecurityError
  );

  assert.throws(
    () =>
      createStudioPreviewClient({
        postMessage() {},
        targetOrigin: "*",
      }),
    GrexSecurityError
  );

  const errors = [];
  const host = mountPreviewHost({
    allowedOrigins: ["http://127.0.0.1:8080"],
    targetWindow: window,
    root,
    document,
    initialSlots: store.documentTree.peek(),
    initialSlot: "home",
    onError: (err) => errors.push(err),
  });

  const titleEl = root.querySelector('[data-grex-id="home-title"]');
  assert.equal(titleEl.textContent, "{site_title}");

  // Untrusted origin -> rejected fail-closed
  const rejected = host.handleMessage({
    origin: "https://attacker.invalid",
    data: {
      channel: PREVIEW_CHANNEL,
      type: "patch-text",
      targetId: "home-title",
      value: "Hacked!",
    },
  });
  assert.equal(rejected, false);
  assert.equal(errors.length, 1);
  assert.equal(titleEl.textContent, "{site_title}");

  // Wrong channel -> rejected fail-closed
  const wrongChan = host.handleMessage({
    origin: "http://127.0.0.1:8080",
    data: {
      channel: "wrong-channel",
      type: "patch-text",
      targetId: "home-title",
      value: "Hacked!",
    },
  });
  assert.equal(wrongChan, false);
  assert.equal(titleEl.textContent, "{site_title}");

  // Trusted origin -> applied cleanly in-memory
  const acceptedText = host.handleMessage({
    origin: "http://127.0.0.1:8080",
    data: {
      channel: PREVIEW_CHANNEL,
      type: "patch-text",
      targetId: "home-title",
      value: "Northbound Studio",
    },
  });
  assert.equal(acceptedText, true);
  assert.equal(titleEl.textContent, "Northbound Studio");

  const acceptedStyle = host.handleMessage({
    origin: "http://127.0.0.1:8080",
    data: {
      channel: PREVIEW_CHANNEL,
      type: "patch-style",
      targetId: "home-title",
      prop: "color",
      value: "#0d9488",
    },
  });
  assert.equal(acceptedStyle, true);
  assert.equal(titleEl.style.getPropertyValue("color"), "#0d9488");

  const acceptedToken = host.handleMessage({
    origin: "http://127.0.0.1:8080",
    data: {
      channel: PREVIEW_CHANNEL,
      type: "patch-token",
      targetId: "home-title",
      token: "--grex-accent",
      value: "#0284c7",
    },
  });
  assert.equal(acceptedToken, true);
  assert.equal(titleEl.style.getPropertyValue("--grex-accent"), "#0284c7");

  host.dispose();
});
