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
  createClassManager,
  compileElementStyles,
  computeContrastRatio,
  GrexSecurityError,
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
  executeBuilderCommand,
  findNodeLocation,
  VALID_BREAKPOINTS,
} from "./commands.js";

export const BUILDER_BREAKPOINTS = Object.freeze({
  base: null,                    // Desktop >= 1025px (unwrapped base rules)
  tablet: "(max-width: 1024px)", // Tablet <= 1024px
  mobile: "(max-width: 767px)",  // Mobile <= 767px
});

export const DEFAULT_THEME_CONFIG = Object.freeze({
  tokens: Object.freeze({
    "--grex-color-primary": "#047857",
    "--grex-color-secondary": "#0f172a",
    "--grex-color-accent": "#0d9488",
    "--grex-color-bg": "#f8fafc",
    "--grex-color-surface": "#ffffff",
    "--grex-color-text": "#0f172a",
    "--grex-color-text-muted": "#475569",
    "--grex-color-border": "#cbd5e1",
    "--grex-font-sans": "\"Inter\", system-ui, -apple-system, sans-serif",
    "--grex-font-heading": "\"Inter\", system-ui, -apple-system, sans-serif",
    "--grex-font-mono": "ui-monospace, SFMono-Regular, Menlo, monospace",
    "--grex-text-base": "1rem",
    "--grex-text-sm": "0.875rem",
    "--grex-text-lg": "1.125rem",
    "--grex-text-xl": "1.25rem",
    "--grex-text-2xl": "1.5rem",
    "--grex-leading-normal": "1.5",
    "--grex-leading-tight": "1.2",
    "--grex-space-1": "0.25rem",
    "--grex-space-2": "0.5rem",
    "--grex-space-3": "0.75rem",
    "--grex-space-4": "1rem",
    "--grex-space-5": "1.5rem",
    "--grex-space-6": "2rem",
    "--grex-space-7": "3rem",
    "--grex-space-8": "4rem",
    "--grex-radius-sm": "0.25rem",
    "--grex-radius-md": "0.5rem",
    "--grex-radius-lg": "0.75rem",
    "--grex-shadow-sm": "0 1px 2px rgba(15, 23, 42, 0.08)",
    "--grex-shadow-md": "0 4px 12px rgba(15, 23, 42, 0.12)",
    "--grex-focus-ring": "2px solid #059669",
  }),
  modes: Object.freeze({
    light: Object.freeze({
      "--grex-color-primary": "#047857",
      "--grex-color-secondary": "#0f172a",
      "--grex-color-accent": "#0d9488",
      "--grex-color-bg": "#f8fafc",
      "--grex-color-surface": "#ffffff",
      "--grex-color-text": "#0f172a",
      "--grex-color-text-muted": "#475569",
      "--grex-color-border": "#cbd5e1",
    }),
    dark: Object.freeze({
      "--grex-color-primary": "#10b981",
      "--grex-color-secondary": "#e2e8f0",
      "--grex-color-accent": "#2dd4bf",
      "--grex-color-bg": "#0f172a",
      "--grex-color-surface": "#1e293b",
      "--grex-color-text": "#f8fafc",
      "--grex-color-text-muted": "#94a3b8",
      "--grex-color-border": "#334155",
    }),
  }),
  prefersColorScheme: false,
});

export const DEFAULT_THEME_TOKENS = DEFAULT_THEME_CONFIG;

function normalizeInitialThemeConfig(rawTheme, fallback) {
  const base = cloneJson(fallback || DEFAULT_THEME_CONFIG);
  if (!rawTheme || typeof rawTheme !== "object") {
    return base;
  }
  if (rawTheme.tokens && typeof rawTheme.tokens === "object") {
    base.tokens = { ...base.tokens, ...rawTheme.tokens };
  }
  if (rawTheme.colors && typeof rawTheme.colors === "object") {
    for (const [k, v] of Object.entries(rawTheme.colors)) {
      const tk = k.startsWith("--grex-") ? k : `--grex-${k}`;
      base.tokens[tk] = v;
    }
  }
  if (rawTheme.modes && typeof rawTheme.modes === "object") {
    base.modes = {
      light: { ...(base.modes?.light || {}), ...(rawTheme.modes.light || {}) },
      dark: { ...(base.modes?.dark || {}), ...(rawTheme.modes.dark || {}) },
    };
  }
  if (typeof rawTheme.prefersColorScheme === "boolean") {
    base.prefersColorScheme = rawTheme.prefersColorScheme;
  }
  return base;
}

function buildContrastWarnings(themeCfg, classReg, activeCls, selNode, bp) {
  const warnings = [];
  const baseTokens = themeCfg?.tokens || {};
  const modes = ["light", "dark"];
  const pairs = [
    ["--grex-color-text", "--grex-color-bg", "Body Text on Background"],
    ["--grex-color-text", "--grex-color-surface", "Body Text on Surface"],
    ["--grex-color-text-muted", "--grex-color-bg", "Muted Text on Background"],
    ["--grex-color-text-muted", "--grex-color-surface", "Muted Text on Surface"],
  ];

  for (const mode of modes) {
    const resolved = { ...baseTokens, ...(themeCfg?.modes?.[mode] || {}) };
    for (const [fgTok, bgTok, label] of pairs) {
      const fg = resolved[fgTok];
      const bg = resolved[bgTok];
      const ratio = computeContrastRatio(fg, bg);
      if (ratio !== null && ratio < 4.5) {
        warnings.push({
          code: "GREX-A11Y-001",
          severity: "warning",
          mode,
          fgToken: fgTok,
          bgToken: bgTok,
          fgColor: fg,
          bgColor: bg,
          ratio,
          label: `${label} (${mode})`,
          message: `${ratio.toFixed(2)}:1 — Below WCAG AA 4.5:1 (${fgTok} on ${bgTok} in ${mode})`,
        });
      }
    }
    const primaryBg = resolved["--grex-color-primary"];
    const primaryFg = mode === "dark" ? "#0f172a" : "#ffffff";
    const primaryRatio = computeContrastRatio(primaryFg, primaryBg);
    if (primaryRatio !== null && primaryRatio < 4.5) {
      warnings.push({
        code: "GREX-A11Y-001",
        severity: "warning",
        mode,
        fgToken: primaryFg,
        bgToken: "--grex-color-primary",
        fgColor: primaryFg,
        bgColor: primaryBg,
        ratio: primaryRatio,
        label: `Primary Button Contrast (${mode})`,
        message: `${primaryRatio.toFixed(2)}:1 — Below WCAG AA 4.5:1 (${primaryFg} on --grex-color-primary in ${mode})`,
      });
    }
  }

  const checkStyleObj = (styleMap, scopeLabel, scopeName) => {
    if (!styleMap || typeof styleMap !== "object") {
      return;
    }
    const merged = { ...(styleMap.base || {}), ...(bp !== "base" ? styleMap[bp] || {} : {}) };
    const fg = merged.color;
    const bg = merged["background-color"] || merged.background;
    const ratio = computeContrastRatio(fg, bg);
    if (ratio !== null && ratio < 4.5) {
      warnings.push({
        code: "GREX-A11Y-001",
        severity: "warning",
        mode: scopeLabel,
        fgToken: "color",
        bgToken: "background-color",
        fgColor: fg,
        bgColor: bg,
        ratio,
        label: `${scopeName} (${bp})`,
        message: `${ratio.toFixed(2)}:1 — Below WCAG AA 4.5:1 on ${scopeName}`,
      });
    }
  };

  if (activeCls && classReg?.[activeCls]) {
    checkStyleObj(classReg[activeCls], "class", `.grex-c-${activeCls}`);
  } else if (selNode?.styles) {
    checkStyleObj(selNode.styles, "element", `#${getNodeId(selNode) || "node"}`);
  }

  return warnings;
}

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
  const initialThemeConfig = normalizeInitialThemeConfig(
    options.themeConfig || initialDoc?.theme,
    DEFAULT_THEME_CONFIG
  );
  const initialClassRegistry = cloneJson(
    options.classRegistry || initialDoc?.classes || {}
  );

  const activeSlot = signal(startSlot);
  const documentTree = signal(initialSlots);
  const themeConfig = signal(initialThemeConfig);
  const activeThemeMode = signal(options.initialThemeMode === "dark" ? "dark" : "light");
  const classRegistry = signal(initialClassRegistry);
  const activeClassName = signal(null);
  const activeBreakpoint = signal("base");
  const selectedNodeId = signal(getNodeId(initialSlots[startSlot]) || null);
  const history = signal(commandStack.createEmptyState());
  const isDirty = signal(false);
  const hasUnpublishedChanges = signal(Boolean(options.hasUnpublishedChanges));
  const saveStatus = signal("idle");
  const lastError = signal(null);
  const lastSavedAt = signal(null);
  const lastPublishedAt = signal(null);

  const serializeFullState = (slots, themeCfg, clsReg) =>
    JSON.stringify({ slots, themeConfig: themeCfg, classRegistry: clsReg });

  let savedBaselineJson = serializeFullState(initialSlots, initialThemeConfig, initialClassRegistry);

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

  const contrastWarnings = computed(() =>
    buildContrastWarnings(
      themeConfig.get(),
      classRegistry.get(),
      activeClassName.get(),
      selectedNode.get(),
      activeBreakpoint.get()
    )
  );

  const compiledCss = computed(() => {
    const tree = documentTree.get();
    const themeCfg = themeConfig.get();
    const clsReg = classRegistry.get();
    const partsMap = extractPartsMap(tree);
    const grexNodes = [];
    for (const rootNode of Object.values(tree)) {
      if (rootNode) {
        grexNodes.push(toGrexJsNode(rootNode, partsMap, 0));
      }
    }
    const themeManager = createTheme(themeCfg);
    const tokensCss = themeManager.compileCss();

    const classMgr = createClassManager({ prefix: "grex-c-" });
    for (const [clsName, clsStyles] of Object.entries(clsReg || {})) {
      classMgr.registerClass(clsName, clsStyles || {});
    }
    const classesCss = classMgr.compileCss({ breakpoints: BUILDER_BREAKPOINTS });
    const elementCss = compileElementStyles(grexNodes, { breakpoints: BUILDER_BREAKPOINTS });
    const builderCss = [tokensCss, classesCss, elementCss].filter(Boolean).join("\n");
    return {
      tokensCss,
      classesCss,
      elementCss,
      builderCss,
    };
  });

  function syncDirtyState(nextSlots, nextTheme, nextClasses) {
    isDirty.set(serializeFullState(nextSlots, nextTheme, nextClasses) !== savedBaselineJson);
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

  function setBreakpoint(bp) {
    const clean = String(bp || "base");
    if (!VALID_BREAKPOINTS.includes(clean)) {
      throw new GrexSecurityError(`Invalid breakpoint "${clean}".`);
    }
    activeBreakpoint.set(clean);
  }

  function setThemeMode(mode) {
    const clean = String(mode || "light").toLowerCase();
    if (clean !== "light" && clean !== "dark") {
      throw new GrexSecurityError(`Invalid theme mode "${clean}".`);
    }
    activeThemeMode.set(clean);
  }

  function setActiveClass(className) {
    if (!className) {
      activeClassName.set(null);
      return null;
    }
    const clean = String(className).trim();
    const reg = classRegistry.peek();
    if (!(clean in reg)) {
      throw new Error(`Unregistered class "${clean}".`);
    }
    activeClassName.set(clean);
    return clean;
  }

  function dispatch(rawCommand, meta = {}) {
    const currentState = untrack(() => ({
      slots: documentTree.get(),
      themeConfig: themeConfig.get(),
      classRegistry: classRegistry.get(),
    }));
    const currentHistory = untrack(() => history.get());

    const { nextState, record } = executeBuilderCommand(currentState, rawCommand, meta);
    const nextHistory = commandStack.pushRecord(currentHistory, record);

    batch(() => {
      documentTree.set(nextState.slots);
      themeConfig.set(nextState.themeConfig);
      classRegistry.set(nextState.classRegistry);
      history.set(nextHistory);
      syncDirtyState(nextState.slots, nextState.themeConfig, nextState.classRegistry);
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
          const slotRoot = nextState.slots[rawCommand.slot];
          selectedNodeId.set(getNodeId(slotRoot) || null);
        }
      } else if (rawCommand.type === "replaceTree") {
        const slotRoot = nextState.slots[rawCommand.slot];
        selectedNodeId.set(getNodeId(slotRoot) || null);
      } else if (rawCommand.type === "upsertClass") {
        const curActiveCls = activeClassName.peek();
        if (rawCommand.action === "delete" && curActiveCls === rawCommand.name) {
          activeClassName.set(null);
        } else if (rawCommand.action === "rename" && curActiveCls === rawCommand.name) {
          activeClassName.set(rawCommand.nextName);
        }
      }
    });

    return record;
  }

  function undo() {
    const currentState = untrack(() => ({
      slots: documentTree.get(),
      themeConfig: themeConfig.get(),
      classRegistry: classRegistry.get(),
    }));
    const currentHistory = untrack(() => history.get());
    const stepped = commandStack.stepUndo(currentState, currentHistory);
    if (!stepped) {
      return false;
    }
    const { nextState } = stepped;
    batch(() => {
      documentTree.set(nextState.slots);
      themeConfig.set(nextState.themeConfig);
      classRegistry.set(nextState.classRegistry);
      history.set(stepped.nextHistory);
      syncDirtyState(nextState.slots, nextState.themeConfig, nextState.classRegistry);
      hasUnpublishedChanges.set(true);
      lastError.set(null);
      const curSlotRoot = nextState.slots[activeSlot.peek()];
      const curSel = selectedNodeId.peek();
      if (!curSel || !findNodeLocation(curSlotRoot, curSel)) {
        selectedNodeId.set(getNodeId(curSlotRoot) || null);
      }
      const curCls = activeClassName.peek();
      if (curCls && !(curCls in nextState.classRegistry)) {
        activeClassName.set(null);
      }
    });
    return true;
  }

  function redo() {
    const currentState = untrack(() => ({
      slots: documentTree.get(),
      themeConfig: themeConfig.get(),
      classRegistry: classRegistry.get(),
    }));
    const currentHistory = untrack(() => history.get());
    const stepped = commandStack.stepRedo(currentState, currentHistory);
    if (!stepped) {
      return false;
    }
    const { nextState } = stepped;
    batch(() => {
      documentTree.set(nextState.slots);
      themeConfig.set(nextState.themeConfig);
      classRegistry.set(nextState.classRegistry);
      history.set(stepped.nextHistory);
      syncDirtyState(nextState.slots, nextState.themeConfig, nextState.classRegistry);
      hasUnpublishedChanges.set(true);
      lastError.set(null);
      const curSlotRoot = nextState.slots[activeSlot.peek()];
      const curSel = selectedNodeId.peek();
      if (!curSel || !findNodeLocation(curSlotRoot, curSel)) {
        selectedNodeId.set(getNodeId(curSlotRoot) || null);
      }
      const curCls = activeClassName.peek();
      if (curCls && !(curCls in nextState.classRegistry)) {
        activeClassName.set(null);
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

  function setThemeToken(mode, token, value, meta = {}) {
    return dispatch({ type: "setThemeToken", mode, token, value }, meta);
  }

  function createClass(name, styles = {}, attachToSelected = true, meta = {}) {
    const rec = dispatch({ type: "upsertClass", action: "create", name, styles }, meta);
    const selId = selectedNodeId.peek();
    const slot = activeSlot.peek();
    if (attachToSelected && selId && slot) {
      dispatch({ type: "assignClass", slot, nodeId: selId, className: name, attached: true }, meta);
    }
    activeClassName.set(name);
    return rec;
  }

  function renameClass(name, nextName, meta = {}) {
    return dispatch({ type: "upsertClass", action: "rename", name, nextName }, meta);
  }

  function duplicateClass(name, nextName, attachToSelected = false, meta = {}) {
    const rec = dispatch({ type: "upsertClass", action: "duplicate", name, nextName }, meta);
    const selId = selectedNodeId.peek();
    const slot = activeSlot.peek();
    if (attachToSelected && selId && slot) {
      dispatch({ type: "assignClass", slot, nodeId: selId, className: nextName, attached: true }, meta);
    }
    activeClassName.set(nextName);
    return rec;
  }

  function deleteClass(name, meta = {}) {
    return dispatch({ type: "upsertClass", action: "delete", name }, meta);
  }

  function assignClass(nodeId, className, attached = true, meta = {}) {
    const slot = activeSlot.peek();
    return dispatch({ type: "assignClass", slot, nodeId, className, attached }, meta);
  }

  function setBreakpointStyle(patch, opts = {}, meta = {}) {
    const breakpoint = opts.breakpoint || activeBreakpoint.peek();
    const targetCls = opts.target === "class" ? opts.className : opts.target === "node" ? null : activeClassName.peek();
    if (targetCls) {
      return dispatch(
        { type: "setBreakpointStyle", target: "class", className: targetCls, breakpoint, patch },
        meta
      );
    }
    const slot = opts.slot || activeSlot.peek();
    const nodeId = opts.nodeId || selectedNodeId.peek();
    return dispatch(
      { type: "setBreakpointStyle", target: "node", slot, nodeId, breakpoint, patch },
      meta
    );
  }

  function replaceSlotTree(slot, nextTree, meta = {}) {
    return dispatch({ type: "replaceTree", slot, nextTree }, meta);
  }

  function exportDocument() {
    return exportGrabLabDocument(
      untrack(() => documentTree.get()),
      {
        theme: untrack(() => themeConfig.get()),
        classes: untrack(() => classRegistry.get()),
      }
    );
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
      savedBaselineJson = serializeFullState(
        untrack(() => documentTree.get()),
        untrack(() => themeConfig.get()),
        untrack(() => classRegistry.get())
      );
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
      savedBaselineJson = serializeFullState(
        untrack(() => documentTree.get()),
        untrack(() => themeConfig.get()),
        untrack(() => classRegistry.get())
      );
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
    themeConfig,
    activeThemeMode,
    classRegistry,
    activeClassName,
    activeBreakpoint,
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
    contrastWarnings,
    compiledCss,
    // Actions
    selectSlot,
    selectNode,
    setBreakpoint,
    setThemeMode,
    setActiveClass,
    dispatch,
    undo,
    redo,
    insertElement,
    deleteElement,
    moveElement,
    updateNodeProps,
    updateNodeStyles,
    updateNodeTag,
    setThemeToken,
    createClass,
    renameClass,
    duplicateClass,
    deleteClass,
    assignClass,
    setBreakpointStyle,
    replaceSlotTree,
    exportDocument,
    saveDraft,
    publish,
    // Helpers
    slotNames: () => Object.keys(documentTree.peek()),
  };
}
