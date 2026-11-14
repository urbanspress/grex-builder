/**
 * Grex Theme Builder — Split-Screen GrexPreviewBridge Host & Studio Client.
 * Uses Grex JS v1.0.0 `createPreviewBridge` + `PREVIEW_CHANNEL = "grex-preview-v1"`
 * with strict non-wildcard origin allowlists and zero-restart DOM patching.
 */

import {
  PREVIEW_CHANNEL,
  GrexSecurityError,
  ELEMENT_REGISTRY,
  registerElementType,
  Section,
  createPreviewBridge,
  signal,
  effect,
  renderNode,
  normalizeStyleProperty,
  validateTokenValue,
} from "./grex.js";
import {
  cloneJson,
  extractPartsMap,
  getNodeElementType,
  getNodeId,
  toGrexJsNode,
} from "./schema.js";

if (!("ForEach" in ELEMENT_REGISTRY)) {
  registerElementType("ForEach", (config = {}, options = {}) => {
    const allowedTag = ["section", "ul", "ol", "tbody"].includes(String(config.tag || "").toLowerCase())
      ? String(config.tag).toLowerCase()
      : "section";
    const sectionTag = allowedTag === "ul" || allowedTag === "ol" || allowedTag === "tbody" ? "section" : allowedTag;
    const mergedAttrs = {
      ...(config.attrs || {}),
      "data-grex-foreach": "query",
    };
    return Section(
      {
        ...config,
        tag: sectionTag,
        attrs: mergedAttrs,
        props: { label: config.props?.label || "Query Loop" },
      },
      options
    );
  });
}

function assertValidAllowedOrigins(allowedOrigins) {
  const list = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : allowedOrigins
      ? Array.from(allowedOrigins)
      : [];
  if (list.length === 0) {
    throw new GrexSecurityError("GrexPreviewBridge requires a non-empty allowedOrigins allowlist.");
  }
  const clean = [];
  for (const origin of list) {
    if (typeof origin !== "string" || origin.trim() === "" || origin.trim() === "*") {
      throw new GrexSecurityError(`Wildcard or empty origin "${String(origin)}" rejected by GrexPreviewBridge.`);
    }
    clean.push(origin.trim());
  }
  return clean;
}

function applyNodeInlineStyles(domEl, node, partsMap) {
  if (!domEl || !node || typeof node !== "object") {
    return;
  }
  const baseStyles = node.styles && (node.styles.base || (!("tablet" in node.styles) && !("mobile" in node.styles) ? node.styles : null));
  if (baseStyles && domEl.style && typeof domEl.style.setProperty === "function") {
    for (const [rawProp, rawVal] of Object.entries(baseStyles)) {
      const prop = normalizeStyleProperty(rawProp);
      const val = validateTokenValue(rawVal);
      if (val !== "") {
        domEl.style.setProperty(prop, val);
      }
    }
  }
  const nid = getNodeId(node);
  if (nid && typeof domEl.setAttribute === "function") {
    domEl.setAttribute("data-grex-id", nid);
  }
  if (Array.isArray(node.children) && Array.isArray(domEl.children)) {
    const domKids = Array.from(domEl.children);
    let domIdx = 0;
    for (const child of node.children) {
      if (getNodeElementType(child) === "TemplatePart") {
        const partName = String(child?.props?.name || "").trim();
        const partNode = partsMap[partName];
        if (partNode && domKids[domIdx]) {
          applyNodeInlineStyles(domKids[domIdx], partNode, partsMap);
          domIdx += 1;
        }
        continue;
      }
      if (domKids[domIdx]) {
        applyNodeInlineStyles(domKids[domIdx], child, partsMap);
        domIdx += 1;
      }
    }
  }
}

function clearNode(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Mount the preview iframe receiver using Grex JS `createPreviewBridge`.
 *
 * @param {{
 *   allowedOrigins: string[] | Set<string>,
 *   targetWindow?: Window,
 *   root: Element,
 *   document?: Document,
 *   initialSlots?: Record<string, object>,
 *   initialSlot?: string,
 *   onError?: (err: Error, event: MessageEvent) => void,
 *   onRender?: (slot: string) => void
 * }} options
 */
export function mountPreviewHost(options) {
  if (!options || typeof options !== "object" || !options.root) {
    throw new TypeError("mountPreviewHost(options) requires { allowedOrigins, root }.");
  }

  const allowedOrigins = assertValidAllowedOrigins(options.allowedOrigins);
  const doc = options.document || options.root.ownerDocument || globalThis.document;
  const targetWindow = options.targetWindow || globalThis.window;
  const root = options.root;

  const treeSync = signal({
    slot: options.initialSlot || "home",
    slots: options.initialSlots ? cloneJson(options.initialSlots) : null,
  });
  const selectedId = signal(null);

  let currentDispose = null;

  function renderPreviewTree() {
    const state = treeSync.get();
    if (!state || !state.slots || !state.slots[state.slot]) {
      return;
    }
    if (currentDispose) {
      currentDispose();
      currentDispose = null;
    }
    clearNode(root);

    const slotNode = state.slots[state.slot];
    const partsMap = extractPartsMap(state.slots);
    const grexTree = toGrexJsNode(slotNode, partsMap, 0);
    const rendered = renderNode(grexTree, { document: doc });
    currentDispose = rendered.dispose;

    applyNodeInlineStyles(rendered.element, slotNode, partsMap);
    root.appendChild(rendered.element);

    const sel = selectedId.get();
    if (sel && typeof root.querySelector === "function") {
      const activeEl = root.querySelector(`[data-grex-id="${String(sel).replace(/["\\]/g, "\\$&")}"]`);
      if (activeEl && typeof activeEl.setAttribute === "function") {
        activeEl.setAttribute("data-grex-selected", "true");
      }
    }

    if (typeof options.onRender === "function") {
      options.onRender(state.slot);
    }
  }

  const stopTreeEffect = effect(renderPreviewTree);
  const stopSelEffect = effect(() => {
    const sel = selectedId.get();
    if (typeof root.querySelectorAll === "function") {
      for (const node of root.querySelectorAll("[data-grex-selected]")) {
        node.removeAttribute("data-grex-selected");
      }
      if (sel && typeof root.querySelector === "function") {
        const target = root.querySelector(`[data-grex-id="${String(sel).replace(/["\\]/g, "\\$&")}"]`);
        if (target) {
          target.setAttribute("data-grex-selected", "true");
        }
      }
    }
  });

  const bridge = createPreviewBridge({
    allowedOrigins,
    targetWindow,
    root,
    signals: {
      treeSync,
      selectedId,
    },
    onError: options.onError,
  });

  bridge.start();

  return {
    channel: PREVIEW_CHANNEL,
    bridge,
    treeSync,
    selectedId,
    handleMessage: bridge.handleMessage,
    dispose() {
      bridge.stop();
      stopTreeEffect();
      stopSelEffect();
      if (currentDispose) {
        currentDispose();
        currentDispose = null;
      }
    },
  };
}

/**
 * Create the studio-side GrexPreviewBridge sender that posts validated patches
 * strictly to `targetOrigin` (never `"*"`).
 *
 * @param {{
 *   postMessage: (msg: object, targetOrigin: string) => void,
 *   targetOrigin: string,
 *   store?: ReturnType<import("./store.js").createBuilderStore>
 * }} options
 */
export function createStudioPreviewClient(options) {
  if (!options || typeof options.postMessage !== "function") {
    throw new TypeError("createStudioPreviewClient(options) requires postMessage(msg, targetOrigin).");
  }
  const [targetOrigin] = assertValidAllowedOrigins([options.targetOrigin]);

  function send(payload) {
    const message = {
      channel: PREVIEW_CHANNEL,
      ...payload,
    };
    options.postMessage(message, targetOrigin);
    return message;
  }

  function patchText(targetId, value) {
    return send({ type: "patch-text", targetId, value: value == null ? "" : String(value) });
  }

  function patchAttr(targetId, attr, value) {
    return send({ type: "patch-attr", targetId, attr, value });
  }

  function patchStyle(targetId, prop, value) {
    return send({ type: "patch-style", targetId, prop, value });
  }

  function patchToken(targetId, token, value) {
    return send({ type: "patch-token", targetId, token, value });
  }

  function syncTree(slot, slots) {
    return send({
      type: "patch-signal",
      key: "treeSync",
      value: { slot, slots: cloneJson(slots) },
    });
  }

  function syncSelected(nodeId) {
    return send({
      type: "patch-signal",
      key: "selectedId",
      value: nodeId || null,
    });
  }

  let stopStoreSync = null;
  if (options.store) {
    const store = options.store;
    const stopA = effect(() => {
      const slot = store.activeSlot.get();
      const slots = store.documentTree.get();
      syncTree(slot, slots);
    });
    const stopB = effect(() => {
      const sel = store.selectedNodeId.get();
      syncSelected(sel);
    });
    stopStoreSync = () => {
      stopA();
      stopB();
    };
  }

  return {
    channel: PREVIEW_CHANNEL,
    targetOrigin,
    send,
    patchText,
    patchAttr,
    patchStyle,
    patchToken,
    syncTree,
    syncSelected,
    dispose() {
      if (stopStoreSync) {
        stopStoreSync();
        stopStoreSync = null;
      }
    },
  };
}
