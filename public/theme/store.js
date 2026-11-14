/**
 * Grex Theme Builder — Pure Grex JS v1.0.0 Reactive Studio Store (createBuilderStore).
 * Zero Vue, Pinia, React, Node.js, Webpack, or Vite dependencies.
 */

import {
  signal,
  computed,
  batch,
  untrack,
  createTheme,
  compileElementStyles,
} from "./grex.js";
import {
  buildDefaultNodeForElement,
  cloneJson,
  evaluateSlotDiagnostics,
  exportGrabLabDocument,
  extractPartsMap,
  getNodeId,
  normalizeSlotDocument,
  toGrexJsNode,
} from "./schema.js";
import {
  createCommandStack,
  DEFAULT_MAX_HISTORY,
  executeTreeCommand,
  findNodeLocation,
} from "./commands.js";

export const DEFAULT_THEME_TOKENS = Object.freeze({
  colors: {
    bg: "#f8fafc",
    surface: "#ffffff",
    ink: "#0f172a",
    muted: "#475569",
    accent: "#0d9488",
    "accent-ink": "#ffffff",
    border: "#cbd5e1",
  },
  spacing: {
    "space-sm": "0.75rem",
    "space-md": "1.5rem",
    "space-lg": "3rem",
  },
  radii: {
    radius: "0.75rem",
  },
  focusRing: "2px solid #0284c7",
});

/**
 * Create the signal-driven Grex Theme Builder studio store.
 *
 * @param {object} initialDoc - Raw `grex.elements.json` or normalized slot map
 * @param {{
 *   initialSlot?: string,
 *   maxHistory?: number,
 *   themeConfig?: object,
 *   hasUnpublishedChanges?: boolean
 * }} [options]
 */
export function createBuilderStore(initialDoc, options = {}) {
  const initialSlots = normalizeSlotDocument(initialDoc);
  const slotKeys = Object.keys(initialSlots);
  const startSlot =
    options.initialSlot && initialSlots[options.initialSlot]
      ? options.initialSlot
      : slotKeys.includes("home")
        ? "home"
        : slotKeys[0];

  const commandStack = createCommandStack({
    maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
  });
  const themeManager = createTheme(options.themeConfig || DEFAULT_THEME_TOKENS);

  const activeSlot = signal(startSlot);
  const documentTree = signal(initialSlots);
  const selectedNodeId = signal(getNodeId(initialSlots[startSlot]) || null);
  const history = signal(commandStack.createEmptyState());
  const isDirty = signal(false);
  const hasUnpublishedChanges = signal(Boolean(options.hasUnpublishedChanges));
  const saveStatus = signal("idle");
  const lastError = signal(null);
  const lastSavedAt = signal(null);
  const lastPublishedAt = signal(null);

  let savedBaselineJson = JSON.stringify(initialSlots);

  const activeSlotTree = computed(() => {
    const slot = activeSlot.get();
    const tree = documentTree.get();
    return tree[slot] || null;
  });

  const selectedNode = computed(() => {
    const root = activeSlotTree.get();
    const id = selectedNodeId.get();
    if (!root || !id) {
      return null;
    }
    const loc = findNodeLocation(root, id);
    return loc ? loc.node : null;
  });

  const canUndo = computed(() => history.get().undoStack.length > 0);
  const canRedo = computed(() => history.get().redoStack.length > 0);

  const validationReport = computed(() => {
    const root = activeSlotTree.get();
    const tree = documentTree.get();
    if (!root) {
      return {
        ok: false,
        valid: false,
        a11yOk: false,
        errors: [{ code: "GREX-SCHEMA-001", message: "Active template slot is empty." }],
        warnings: [],
        issues: [{ severity: "error", code: "GREX-SCHEMA-001", message: "Active template slot is empty." }],
      };
    }
    return evaluateSlotDiagnostics(root, extractPartsMap(tree));
  });

  const fullDocumentDiagnostics = computed(() => {
    const tree = documentTree.get();
    const partsMap = extractPartsMap(tree);
    const errors = [];
    const warnings = [];
    const bySlot = {};

    for (const [slotName, slotRoot] of Object.entries(tree)) {
      const diag = evaluateSlotDiagnostics(slotRoot, partsMap);
      bySlot[slotName] = diag;
      for (const err of diag.errors) {
        errors.push({ slot: slotName, ...err });
      }
      for (const warn of diag.warnings) {
        warnings.push({ slot: slotName, ...warn });
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      bySlot,
    };
  });

  const compiledCss = computed(() => {
    const tree = documentTree.get();
    const partsMap = extractPartsMap(tree);
    const grexNodes = [];
    for (const rootNode of Object.values(tree)) {
      if (rootNode) {
        grexNodes.push(toGrexJsNode(rootNode, partsMap, 0));
      }
    }
    const tokensCss = themeManager.compileCss();
    const elementCss = compileElementStyles(grexNodes);
    const builderCss = [tokensCss, elementCss].filter(Boolean).join("\n");
    return {
      tokensCss,
      elementCss,
      builderCss,
    };
  });

  function syncDirtyState(nextTree) {
    isDirty.set(JSON.stringify(nextTree) !== savedBaselineJson);
  }

  function selectSlot(slotName) {
    const tree = documentTree.peek();
    if (!tree[slotName]) {
      throw new Error(`Unknown template slot "${String(slotName)}".`);
    }
    batch(() => {
      activeSlot.set(slotName);
      selectedNodeId.set(getNodeId(tree[slotName]) || null);
      lastError.set(null);
    });
  }

  function selectNode(nodeId) {
    const root = activeSlotTree.peek();
    if (!nodeId) {
      selectedNodeId.set(null);
      return null;
    }
    const loc = root ? findNodeLocation(root, nodeId) : null;
    if (!loc) {
      return null;
    }
    selectedNodeId.set(nodeId);
    return loc.node;
  }

  function dispatch(rawCommand, meta = {}) {
    const currentTree = untrack(() => documentTree.get());
    const currentHistory = untrack(() => history.get());

    const { nextSlots, record } = executeTreeCommand(currentTree, rawCommand, meta);
    const nextHistory = commandStack.pushRecord(currentHistory, record);

    batch(() => {
      documentTree.set(nextSlots);
      history.set(nextHistory);
      syncDirtyState(nextSlots);
      hasUnpublishedChanges.set(true);
      lastError.set(null);
      if (saveStatus.peek() === "error" || saveStatus.peek() === "published" || saveStatus.peek() === "saved") {
        saveStatus.set("idle");
      }
      if (rawCommand.type === "insertNode") {
        const insertedId = getNodeId(rawCommand.node);
        if (insertedId) {
          selectedNodeId.set(insertedId);
        }
      } else if (rawCommand.type === "deleteNode") {
        const curSel = selectedNodeId.peek();
        if (curSel === rawCommand.nodeId) {
          const slotRoot = nextSlots[rawCommand.slot];
          selectedNodeId.set(getNodeId(slotRoot) || null);
        }
      } else if (rawCommand.type === "replaceTree") {
        const slotRoot = nextSlots[rawCommand.slot];
        selectedNodeId.set(getNodeId(slotRoot) || null);
      }
    });

    return record;
  }

  function undo() {
    const currentTree = untrack(() => documentTree.get());
    const currentHistory = untrack(() => history.get());
    const stepped = commandStack.stepUndo(currentTree, currentHistory);
    if (!stepped) {
      return false;
    }
    batch(() => {
      documentTree.set(stepped.nextSlots);
      history.set(stepped.nextHistory);
      syncDirtyState(stepped.nextSlots);
      hasUnpublishedChanges.set(true);
      lastError.set(null);
      const curSlotRoot = stepped.nextSlots[activeSlot.peek()];
      const curSel = selectedNodeId.peek();
      if (!curSel || !findNodeLocation(curSlotRoot, curSel)) {
        selectedNodeId.set(getNodeId(curSlotRoot) || null);
      }
    });
    return true;
  }

  function redo() {
    const currentTree = untrack(() => documentTree.get());
    const currentHistory = untrack(() => history.get());
    const stepped = commandStack.stepRedo(currentTree, currentHistory);
    if (!stepped) {
      return false;
    }
    batch(() => {
      documentTree.set(stepped.nextSlots);
      history.set(stepped.nextHistory);
      syncDirtyState(stepped.nextSlots);
      hasUnpublishedChanges.set(true);
      lastError.set(null);
      const curSlotRoot = stepped.nextSlots[activeSlot.peek()];
      const curSel = selectedNodeId.peek();
      if (!curSel || !findNodeLocation(curSlotRoot, curSel)) {
        selectedNodeId.set(getNodeId(curSlotRoot) || null);
      }
    });
    return true;
  }

  function insertElement(elementType, parentId = null, index = undefined, meta = {}) {
    const slot = activeSlot.peek();
    const root = documentTree.peek()[slot];
    const targetParent = parentId || getNodeId(root);
    const node = buildDefaultNodeForElement(elementType);
    dispatch({ type: "insertNode", slot, parentId: targetParent, index, node }, meta);
    return node;
  }

  function deleteElement(nodeId, meta = {}) {
    const slot = activeSlot.peek();
    return dispatch({ type: "deleteNode", slot, nodeId }, meta);
  }

  function moveElement(nodeId, targetParentId, targetIndex, meta = {}) {
    const slot = activeSlot.peek();
    return dispatch({ type: "moveNode", slot, nodeId, targetParentId, targetIndex }, meta);
  }

  function updateNodeProps(nodeId, patch, meta = {}) {
    const slot = activeSlot.peek();
    return dispatch({ type: "updateProps", slot, nodeId, patch }, meta);
  }

  function updateNodeStyles(nodeId, stylesPatch, meta = {}) {
    const slot = activeSlot.peek();
    return dispatch({ type: "updateStyles", slot, nodeId, stylesPatch }, meta);
  }

  function updateNodeTag(nodeId, nextTag, meta = {}) {
    return updateNodeProps(nodeId, { tag: nextTag }, meta);
  }

  function replaceSlotTree(slot, nextTree, meta = {}) {
    return dispatch({ type: "replaceTree", slot, nextTree }, meta);
  }

  function exportDocument() {
    return exportGrabLabDocument(untrack(() => documentTree.get()));
  }

  async function saveDraft(transport) {
    if (!transport || typeof transport.saveDraft !== "function") {
      throw new TypeError("saveDraft(transport) requires transport.saveDraft(payload).");
    }
    const diag = untrack(() => fullDocumentDiagnostics.get());
    if (diag.errors.some((e) => e.code === "GREX-SCHEMA-001")) {
      const msg = diag.errors[0].message;
      batch(() => {
        saveStatus.set("error");
        lastError.set(msg);
      });
      return { ok: false, error: msg };
    }

    saveStatus.set("saving");
    lastError.set(null);
    const exportedDoc = exportDocument();
    const historySnapshot = cloneJson(untrack(() => history.get()));

    try {
      const res = await transport.saveDraft({
        document: exportedDoc,
        history: historySnapshot,
      });
      if (res && res.ok === false) {
        const msg = res.error || "Failed to save draft.";
        batch(() => {
          saveStatus.set("error");
          lastError.set(msg);
        });
        return { ok: false, error: msg };
      }
      savedBaselineJson = JSON.stringify(untrack(() => documentTree.get()));
      batch(() => {
        isDirty.set(false);
        saveStatus.set("saved");
        lastSavedAt.set(new Date().toISOString());
        lastError.set(null);
      });
      return { ok: true, result: res };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      batch(() => {
        saveStatus.set("error");
        lastError.set(msg);
      });
      return { ok: false, error: msg };
    }
  }

  async function publish(transport) {
    if (!transport || typeof transport.publish !== "function") {
      throw new TypeError("publish(transport) requires transport.publish(payload).");
    }

    const diag = untrack(() => fullDocumentDiagnostics.get());
    if (!diag.ok) {
      const first = diag.errors[0];
      const msg = `Publish blocked (${first.slot}: ${first.code}): ${first.message}`;
      batch(() => {
        saveStatus.set("error");
        lastError.set(msg);
      });
      return { ok: false, error: msg, diagnostics: diag };
    }

    saveStatus.set("publishing");
    lastError.set(null);

    const exportedDoc = exportDocument();
    const css = untrack(() => compiledCss.get());

    try {
      const res = await transport.publish({
        document: exportedDoc,
        tokensCss: css.tokensCss,
        builderCss: css.builderCss,
      });
      if (res && res.ok === false) {
        const msg = res.error || "Publish failed.";
        batch(() => {
          saveStatus.set("error");
          lastError.set(msg);
        });
        return { ok: false, error: msg };
      }
      savedBaselineJson = JSON.stringify(untrack(() => documentTree.get()));
      batch(() => {
        isDirty.set(false);
        hasUnpublishedChanges.set(false);
        saveStatus.set("published");
        lastPublishedAt.set(new Date().toISOString());
        lastError.set(null);
      });
      return { ok: true, result: res, css };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      batch(() => {
        saveStatus.set("error");
        lastError.set(msg);
      });
      return { ok: false, error: msg };
    }
  }

  return {
    // Reactive signals
    activeSlot,
    documentTree,
    selectedNodeId,
    history,
    isDirty,
    hasUnpublishedChanges,
    saveStatus,
    lastError,
    lastSavedAt,
    lastPublishedAt,
    // Computed diagnostics & derivations
    activeSlotTree,
    selectedNode,
    canUndo,
    canRedo,
    validationReport,
    fullDocumentDiagnostics,
    compiledCss,
    // Actions
    selectSlot,
    selectNode,
    dispatch,
    undo,
    redo,
    insertElement,
    deleteElement,
    moveElement,
    updateNodeProps,
    updateNodeStyles,
    updateNodeTag,
    replaceSlotTree,
    exportDocument,
    saveDraft,
    publish,
    // Helpers
    slotNames: () => Object.keys(documentTree.peek()),
  };
}
