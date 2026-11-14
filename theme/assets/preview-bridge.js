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
  ForEach,
  createPreviewBridge,
  signal,
  effect,
  renderNode,
} from "./grex.js";
import {
  cloneJson,
  extractPartsMap,
  getNodeElementType,
  getNodeId,
  toGrexJsNode,
} from "./schema.js";
import {
  DEFAULT_PREVIEW_CONTEXT,
  filterPreviewEntries,
  resolveDynamicProps,
} from "./templates.js";

if (!("ForEach" in ELEMENT_REGISTRY)) {
  registerElementType("ForEach", (config = {}, options = {}) => ForEach(config, options));
}

function buildPreviewGrexTree(rawNode, partsMap, ctx, depth = 0) {
  if (!rawNode || typeof rawNode !== "object" || depth > 24) {
    return rawNode;
  }
  const elType = getNodeElementType(rawNode);

  if (elType === "TemplatePart") {
    const partName = String(rawNode?.props?.name || "").trim();
    if (partName && partsMap && partsMap[partName]) {
      return buildPreviewGrexTree(partsMap[partName], partsMap, ctx, depth + 1);
    }
    return toGrexJsNode(rawNode, partsMap, depth);
  }

  const isLoop =
    elType === "ForEach" ||
    (rawNode.queryLoop && rawNode.queryLoop.enabled === true && ["Grid", "Stack", "Section"].includes(elType));

  if (isLoop) {
    const queryCfg = rawNode.queryLoop?.enabled
      ? rawNode.queryLoop
      : rawNode.props?.query || { per_page: 6 };
    const { items } = filterPreviewEntries(ctx?.entries || [], queryCfg);
    const parentType = elType === "ForEach" ? "Section" : elType;
    const baseGrex = toGrexJsNode(
      { ...rawNode, element: parentType, children: [] },
      partsMap,
      depth
    );
    baseGrex.attrs = {
      ...(baseGrex.attrs || {}),
      "data-grex-foreach": "query",
    };
    const itemTemplate =
      Array.isArray(rawNode.children) && rawNode.children.length > 0
        ? rawNode.children[0]
        : partsMap.card || {
            id: `${getNodeId(rawNode) || "loop"}-item`,
            element: "Card",
            tag: "article",
            props: { label: "{{ entry.title }}" },
            children: [
              {
                id: `${getNodeId(rawNode) || "loop"}-item-title`,
                element: "Heading",
                tag: "h3",
                props: { level: 3, text: "{{ entry.title }}" },
              },
              {
                id: `${getNodeId(rawNode) || "loop"}-item-excerpt`,
                element: "Text",
                tag: "p",
                props: { text: "{{ entry.excerpt }}" },
              },
            ],
          };

    return {
      type: "ForEach",
      parent: baseGrex,
      items,
      key: (item, idx) => (item && item.id != null ? String(item.id) : `idx-${idx}`),
      render: (itemSig) => {
        const item = typeof itemSig?.get === "function" ? itemSig.get() : itemSig;
        const itemCtx = { ...ctx, entry: item || {} };
        return buildPreviewGrexTree(itemTemplate, partsMap, itemCtx, depth + 1);
      },
      empty: () => ({
        type: "Text",
        tag: "p",
        props: { text: queryCfg.empty_text || "No matching entries found." },
      }),
    };
  }

  const grexNode = toGrexJsNode({ ...rawNode, children: [] }, partsMap, depth);
  if (ctx) {
    if (rawNode.bindings && typeof rawNode.bindings === "object") {
      grexNode.props = { ...(grexNode.props || {}) };
      for (const [bKey, bVal] of Object.entries(rawNode.bindings)) {
        if (typeof bVal === "string" && bVal !== "") {
          grexNode.props[bKey] = bVal;
        }
      }
    }
    grexNode.props = resolveDynamicProps(grexNode.props, ctx);
  }

  if (grexNode.type === "Nav") {
    const loc = String(rawNode.props?.location || "primary").toLowerCase();
    const menuItems = ctx?.menus?.[loc];
    if (Array.isArray(menuItems) && menuItems.length > 0 && (!Array.isArray(grexNode.props.items) || grexNode.props.items.length === 0)) {
      grexNode.props.items = menuItems.map((m) => ({
        href: m.href || m.url || "/",
        text: m.text || m.label || "Link",
      }));
    }
    if (ctx?.path) {
      grexNode.props.activePath = ctx.path;
    }
  }

  if (Array.isArray(rawNode.children) && rawNode.children.length > 0) {
    grexNode.children = rawNode.children.map((ch) =>
      buildPreviewGrexTree(ch, partsMap, ctx, depth + 1)
    );
  }

  return grexNode;
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

function markNodeIds(domEl, node, partsMap) {
  if (!domEl || !node || typeof node !== "object") {
    return;
  }
  const nid = getNodeId(node);
  if (nid && typeof domEl.setAttribute === "function") {
    domEl.setAttribute("data-grex-id", nid);
  }
  const elType = getNodeElementType(node);
  if (elType === "ForEach" || (node.queryLoop && node.queryLoop.enabled === true)) {
    return;
  }
  if (Array.isArray(node.children) && Array.isArray(domEl.children)) {
    const domKids = Array.from(domEl.children);
    let domIdx = 0;
    for (const child of node.children) {
      if (getNodeElementType(child) === "TemplatePart") {
        const partName = String(child?.props?.name || "").trim();
        const partNode = partsMap[partName];
        if (partNode && domKids[domIdx]) {
          markNodeIds(domKids[domIdx], partNode, partsMap);
          domIdx += 1;
        }
        continue;
      }
      if (domKids[domIdx]) {
        markNodeIds(domKids[domIdx], child, partsMap);
        domIdx += 1;
      }
    }
  }
}

function upsertLiveStyleSheet(doc, fallbackParent, id, cssText) {
  if (!doc) {
    return;
  }
  const parent = doc.head || fallbackParent;
  if (!parent || typeof doc.createElement !== "function") {
    return;
  }
  let styleEl = typeof doc.getElementById === "function" ? doc.getElementById(id) : null;
  if (!styleEl && typeof parent.querySelector === "function") {
    styleEl = parent.querySelector(`#${id}`);
  }
  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = id;
    parent.appendChild(styleEl);
  }
  styleEl.textContent = cssText || "";
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
  const styleSync = signal(
    options.initialStyles || {
      tokensCss: "",
      classesCss: "",
      elementsCss: "",
      themeMode: "light",
    }
  );
  const contextSync = signal(
    options.initialContext ? cloneJson(options.initialContext) : null
  );
  const selectedId = signal(null);

  let currentDispose = null;

  function renderPreviewTree() {
    const state = treeSync.get();
    const ctx = contextSync.get();
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
    const grexTree = buildPreviewGrexTree(slotNode, partsMap, ctx, 0);
    const rendered = renderNode(grexTree, { document: doc });
    currentDispose = rendered.dispose;

    markNodeIds(rendered.element, slotNode, partsMap);
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

  const stopStyleEffect = effect(() => {
    const st = styleSync.get() || {};
    upsertLiveStyleSheet(doc, root, "grex-live-tokens", st.tokensCss || "");
    upsertLiveStyleSheet(doc, root, "grex-live-classes", st.classesCss || "");
    upsertLiveStyleSheet(doc, root, "grex-live-elements", st.elementsCss || "");
    const mode = st.themeMode === "dark" ? "dark" : "light";
    if (doc?.documentElement && typeof doc.documentElement.setAttribute === "function") {
      doc.documentElement.setAttribute("data-grex-theme", mode);
    }
  });

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
      styleSync,
      contextSync,
      selectedId,
    },
    onError: options.onError,
  });

  bridge.start();

  return {
    channel: PREVIEW_CHANNEL,
    bridge,
    treeSync,
    styleSync,
    contextSync,
    selectedId,
    handleMessage: bridge.handleMessage,
    dispose() {
      bridge.stop();
      stopStyleEffect();
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

  function syncStyles(stylesPayload) {
    return send({
      type: "patch-signal",
      key: "styleSync",
      value: {
        tokensCss: stylesPayload?.tokensCss || "",
        classesCss: stylesPayload?.classesCss || "",
        elementsCss: stylesPayload?.elementsCss || "",
        themeMode: stylesPayload?.themeMode === "dark" ? "dark" : "light",
      },
    });
  }

  function syncContext(ctxPayload) {
    return send({
      type: "patch-signal",
      key: "contextSync",
      value: cloneJson(ctxPayload || DEFAULT_PREVIEW_CONTEXT),
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
    const stopC = effect(() => {
      const css = store.compiledCss.get();
      const mode = store.activeThemeMode ? store.activeThemeMode.get() : "light";
      syncStyles({
        tokensCss: css.tokensCss,
        classesCss: css.classesCss || "",
        elementsCss: css.elementCss || "",
        themeMode: mode,
      });
    });
    const stopD = store.previewContext
      ? effect(() => {
          syncContext(store.previewContext.get());
        })
      : () => {};
    stopStoreSync = () => {
      stopA();
      stopB();
      stopC();
      stopD();
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
    syncStyles,
    syncContext,
    dispose() {
      if (stopStoreSync) {
        stopStoreSync();
        stopStoreSync = null;
      }
    },
  };
}
