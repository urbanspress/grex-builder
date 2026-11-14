/**
 * Grex Theme Builder — Deterministic Undo/Redo Command Stack (v0.1).
 * Every mutation executes as a JSON-serializable command with an exact inverse,
 * shared identically by human designers and Groxy AI (`grab mcp`).
 */

import {
  GrexSecurityError,
  isSafeUrl,
  normalizeStyleProperty,
  normalizeTokenName,
  validateTokenValue,
} from "./grex.js";
import {
  cloneJson,
  extractPartsMap,
  getNodeElementType,
  getNodeId,
  normalizeStudioNode,
  validateStudioNode,
} from "./schema.js";
import {
  buildDefaultTemplateRegistry,
  normalizeQueryLoopConfig,
  normalizeTemplateConditions,
} from "./templates.js";

export const COMMAND_TYPES = Object.freeze([
  "insertNode",
  "deleteNode",
  "moveNode",
  "updateProps",
  "updateStyles",
  "replaceTree",
  "setThemeToken",
  "upsertClass",
  "assignClass",
  "setBreakpointStyle",
  "setTemplateConditions",
  "upsertTemplate",
  "configureQueryLoop",
  "bindDynamicField",
  "bindMediaAsset",
  "bindNavigationMenu",
]);

export const VALID_BREAKPOINTS = Object.freeze(["base", "tablet", "mobile"]);
const CLASS_PREFIX = "grex-c-";

function assertValidClassSlug(name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9_-]*$/i.test(name.trim())) {
    throw new GrexSecurityError(`Invalid class name "${String(name)}".`);
  }
  return name.trim();
}

function getClassTokens(node) {
  const raw = String(node?.props?.class || "").trim();
  return raw ? raw.split(/\s+/).filter(Boolean) : [];
}

function setClassTokens(node, tokens) {
  node.props = node.props || {};
  const clean = [];
  const seen = new Set();
  for (const t of tokens) {
    if (t && !seen.has(t)) {
      seen.add(t);
      clean.push(t);
    }
  }
  if (clean.length === 0) {
    delete node.props.class;
  } else {
    node.props.class = clean.join(" ");
  }
}

function walkSlotNodes(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }
  visitor(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkSlotNodes(child, visitor);
    }
  }
}

function normalizeBreakpointStyleMap(styles) {
  if (!styles || typeof styles !== "object") {
    return {};
  }
  const hasBp = "base" in styles || "tablet" in styles || "mobile" in styles;
  const source = hasBp ? styles : { base: styles };
  const out = {};
  for (const bp of VALID_BREAKPOINTS) {
    const bpMap = source[bp];
    if (!bpMap || typeof bpMap !== "object") {
      continue;
    }
    const cleanMap = {};
    for (const [k, v] of Object.entries(bpMap)) {
      if (v === null || v === undefined || v === "") {
        continue;
      }
      cleanMap[normalizeStyleProperty(k)] = validateTokenValue(v);
    }
    if (Object.keys(cleanMap).length > 0) {
      out[bp] = cleanMap;
    }
  }
  return out;
}

export const DEFAULT_MAX_HISTORY = 200;

/**
 * Find a node and its parent/index inside a slot tree.
 * @param {object} root
 * @param {string} targetId
 * @param {object | null} [parent]
 * @param {number} [index]
 * @returns {{ node: object, parent: object | null, index: number } | null}
 */
export function findNodeLocation(root, targetId, parent = null, index = -1) {
  if (!root || typeof root !== "object") {
    return null;
  }
  if (getNodeId(root) === targetId) {
    return { node: root, parent, index };
  }
  if (Array.isArray(root.children)) {
    for (let i = 0; i < root.children.length; i += 1) {
      const hit = findNodeLocation(root.children[i], targetId, root, i);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

function isDescendant(root, ancestorId, candidateId) {
  const loc = findNodeLocation(root, ancestorId);
  if (!loc) {
    return false;
  }
  return Boolean(findNodeLocation(loc.node, candidateId));
}

function ensureChildrenArray(node) {
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
  return node.children;
}

function clampIndex(idx, length) {
  if (typeof idx !== "number" || Number.isNaN(idx)) {
    return length;
  }
  return Math.max(0, Math.min(Math.trunc(idx), length));
}

function applyStylesPatch(currentStyles, stylesPatch) {
  const next = cloneJson(currentStyles || {});
  const isBreakpointPatch =
    stylesPatch &&
    typeof stylesPatch === "object" &&
    ("base" in stylesPatch || "tablet" in stylesPatch || "mobile" in stylesPatch);

  if (isBreakpointPatch) {
    for (const [bp, bpPatch] of Object.entries(stylesPatch)) {
      if (!bpPatch || typeof bpPatch !== "object") {
        continue;
      }
      const target = { ...(next[bp] || {}) };
      for (const [k, v] of Object.entries(bpPatch)) {
        if (v === null || v === undefined || v === "") {
          delete target[k];
        } else {
          target[k] = v;
        }
      }
      if (Object.keys(target).length === 0) {
        delete next[bp];
      } else {
        next[bp] = target;
      }
    }
    return next;
  }

  const target = { ...(next.base || {}) };
  for (const [k, v] of Object.entries(stylesPatch || {})) {
    if (v === null || v === undefined || v === "") {
      delete target[k];
    } else {
      target[k] = v;
    }
  }
  if (Object.keys(target).length === 0) {
    delete next.base;
  } else {
    next.base = target;
  }
  return next;
}

function capturePreviousStyles(currentStyles, stylesPatch) {
  const styles = currentStyles || {};
  const isBreakpointPatch =
    stylesPatch &&
    typeof stylesPatch === "object" &&
    ("base" in stylesPatch || "tablet" in stylesPatch || "mobile" in stylesPatch);

  if (isBreakpointPatch) {
    const prev = {};
    for (const [bp, bpPatch] of Object.entries(stylesPatch)) {
      if (!bpPatch || typeof bpPatch !== "object") {
        continue;
      }
      const existingBp = styles[bp] || {};
      prev[bp] = {};
      for (const k of Object.keys(bpPatch)) {
        prev[bp][k] = k in existingBp ? existingBp[k] : null;
      }
    }
    return prev;
  }

  const existingBase = styles.base || {};
  const prev = {};
  for (const k of Object.keys(stylesPatch || {})) {
    prev[k] = k in existingBase ? existingBase[k] : null;
  }
  return prev;
}

/**
 * Execute a deterministic command against `{ slots, themeConfig, classRegistry }` and return
 * `{ nextState, nextSlots, record }`, where `record` contains serializable `command` & `inverse`.
 * Rejects invalid/unsafe mutations with `GrexSecurityError` or `Error` before returning.
 *
 * @param {{ slots: Record<string, object>, themeConfig?: object, classRegistry?: Record<string, object> }} state
 * @param {object} rawCommand
 * @param {{ actor?: string }} [meta]
 * @returns {{ nextState: { slots: Record<string, object>, themeConfig: object, classRegistry: Record<string, object> }, nextSlots: Record<string, object>, record: object }}
 */
export function executeBuilderCommand(state, rawCommand, meta = {}) {
  if (!rawCommand || typeof rawCommand !== "object") {
    throw new GrexSecurityError("Builder command must be a non-null object.");
  }
  const { type } = rawCommand;
  if (!COMMAND_TYPES.includes(type)) {
    throw new GrexSecurityError(`Unsupported builder command type "${String(type)}".`);
  }

  const nextSlots = cloneJson(state?.slots || {});
  const nextThemeConfig = cloneJson(
    state?.themeConfig || { tokens: {}, modes: { light: {}, dark: {} }, prefersColorScheme: false }
  );
  if (!nextThemeConfig.tokens || typeof nextThemeConfig.tokens !== "object") {
    nextThemeConfig.tokens = {};
  }
  if (!nextThemeConfig.modes || typeof nextThemeConfig.modes !== "object") {
    nextThemeConfig.modes = { light: {}, dark: {} };
  }
  const nextClassRegistry = cloneJson(state?.classRegistry || {});
  const nextTemplateRegistry = Array.isArray(state?.templateRegistry)
    ? cloneJson(state.templateRegistry)
    : buildDefaultTemplateRegistry(nextSlots);

  let inverse = null;
  let touchedSlot = null;

  if (
    type === "insertNode" ||
    type === "deleteNode" ||
    type === "moveNode" ||
    type === "updateProps" ||
    type === "updateStyles" ||
    type === "replaceTree"
  ) {
    const { slot } = rawCommand;
    if (typeof slot !== "string" || !nextSlots || !nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${String(slot)}".`);
    }
    touchedSlot = slot;
    const root = nextSlots[slot];

    switch (type) {
      case "insertNode": {
        const normalizedNode = normalizeStudioNode(rawCommand.node);
        const nodeId = getNodeId(normalizedNode);
        if (findNodeLocation(root, nodeId)) {
          throw new GrexSecurityError(`Duplicate node id "${nodeId}" in slot "${slot}".`);
        }
        const parentLoc = rawCommand.parentId
          ? findNodeLocation(root, rawCommand.parentId)
          : { node: root, parent: null, index: -1 };
        if (!parentLoc) {
          throw new GrexSecurityError(`Parent node "${String(rawCommand.parentId)}" not found.`);
        }
        const kids = ensureChildrenArray(parentLoc.node);
        const insertIdx = clampIndex(rawCommand.index, kids.length);
        kids.splice(insertIdx, 0, normalizedNode);
        inverse = {
          type: "deleteNode",
          slot,
          nodeId,
        };
        break;
      }

      case "deleteNode": {
        const nodeId = String(rawCommand.nodeId || "");
        const loc = findNodeLocation(root, nodeId);
        if (!loc) {
          throw new GrexSecurityError(`Node "${nodeId}" not found for deleteNode.`);
        }
        if (!loc.parent) {
          throw new GrexSecurityError(`Cannot delete root container node "${nodeId}" of slot "${slot}".`);
        }
        const removed = cloneJson(loc.node);
        const parentId = getNodeId(loc.parent);
        loc.parent.children.splice(loc.index, 1);
        inverse = {
          type: "insertNode",
          slot,
          parentId,
          index: loc.index,
          node: removed,
        };
        break;
      }

      case "moveNode": {
        const nodeId = String(rawCommand.nodeId || "");
        const targetParentId = String(rawCommand.targetParentId || "");
        const loc = findNodeLocation(root, nodeId);
        if (!loc || !loc.parent) {
          throw new GrexSecurityError(`Movable node "${nodeId}" not found.`);
        }
        if (nodeId === targetParentId || isDescendant(root, nodeId, targetParentId)) {
          throw new GrexSecurityError(`Cannot move node "${nodeId}" into itself or its descendant.`);
        }
        const prevParentId = getNodeId(loc.parent);
        const prevIndex = loc.index;
        const [movedNode] = loc.parent.children.splice(loc.index, 1);

        const targetLoc = findNodeLocation(root, targetParentId);
        if (!targetLoc) {
          throw new GrexSecurityError(`Target parent "${targetParentId}" not found.`);
        }
        const targetKids = ensureChildrenArray(targetLoc.node);
        const insertIdx = clampIndex(rawCommand.targetIndex, targetKids.length);
        targetKids.splice(insertIdx, 0, movedNode);

        inverse = {
          type: "moveNode",
          slot,
          nodeId,
          targetParentId: prevParentId,
          targetIndex: prevIndex,
        };
        break;
      }

      case "updateProps": {
        const nodeId = String(rawCommand.nodeId || "");
        const patch = rawCommand.patch;
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
          throw new GrexSecurityError("updateProps requires a non-null patch object.");
        }
        const loc = findNodeLocation(root, nodeId);
        if (!loc) {
          throw new GrexSecurityError(`Node "${nodeId}" not found for updateProps.`);
        }
        const prevPatch = {};
        loc.node.props = loc.node.props || {};
        for (const [key, val] of Object.entries(patch)) {
          if (key === "tag") {
            prevPatch.tag = loc.node.tag !== undefined ? loc.node.tag : null;
            if (val === null || val === undefined || val === "") {
              delete loc.node.tag;
            } else {
              const cleanTag = String(val).trim().toLowerCase();
              loc.node.tag = cleanTag;
              if ((loc.node.element === "Heading" || loc.node.type === "Heading") && /^h[1-6]$/.test(cleanTag)) {
                prevPatch.level = loc.node.props.level !== undefined ? loc.node.props.level : null;
                loc.node.props.level = Number(cleanTag.slice(1));
              }
            }
            continue;
          }
          if (key === "id") {
            throw new GrexSecurityError("Node id is immutable after insertion.");
          }
          prevPatch[key] = key in loc.node.props ? cloneJson(loc.node.props[key]) : null;
          if (val === null || val === undefined) {
            delete loc.node.props[key];
          } else {
            loc.node.props[key] = cloneJson(val);
            if ((loc.node.element === "Heading" || loc.node.type === "Heading") && key === "level") {
              const lvl = Number(val);
              if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 6 && loc.node.tag) {
                prevPatch.tag = loc.node.tag;
                loc.node.tag = `h${lvl}`;
              }
            }
          }
        }
        inverse = {
          type: "updateProps",
          slot,
          nodeId,
          patch: prevPatch,
        };
        break;
      }

      case "updateStyles": {
        const nodeId = String(rawCommand.nodeId || "");
        const stylesPatch = rawCommand.stylesPatch;
        if (!stylesPatch || typeof stylesPatch !== "object" || Array.isArray(stylesPatch)) {
          throw new GrexSecurityError("updateStyles requires a non-null stylesPatch object.");
        }
        const loc = findNodeLocation(root, nodeId);
        if (!loc) {
          throw new GrexSecurityError(`Node "${nodeId}" not found for updateStyles.`);
        }
        const prevStylesPatch = capturePreviousStyles(loc.node.styles, stylesPatch);
        const nextStyles = applyStylesPatch(loc.node.styles, stylesPatch);
        if (Object.keys(nextStyles).length === 0) {
          delete loc.node.styles;
        } else {
          loc.node.styles = nextStyles;
        }
        inverse = {
          type: "updateStyles",
          slot,
          nodeId,
          stylesPatch: prevStylesPatch,
        };
        break;
      }

      case "replaceTree": {
        const prevTree = cloneJson(root);
        const nextTree = normalizeStudioNode(rawCommand.nextTree, slot);
        nextSlots[slot] = nextTree;
        inverse = {
          type: "replaceTree",
          slot,
          nextTree: prevTree,
        };
        break;
      }
    }
  } else if (type === "setThemeToken") {
    const mode = String(rawCommand.mode || "base").toLowerCase();
    if (!["base", "light", "dark", "preferences"].includes(mode)) {
      throw new GrexSecurityError(`Invalid theme mode "${String(rawCommand.mode)}".`);
    }
    if (mode === "preferences") {
      if (rawCommand.token !== "prefersColorScheme") {
        throw new GrexSecurityError(`Unsupported theme preference "${String(rawCommand.token)}".`);
      }
      const prevPref = Boolean(nextThemeConfig.prefersColorScheme);
      nextThemeConfig.prefersColorScheme = Boolean(rawCommand.value);
      inverse = {
        type: "setThemeToken",
        mode: "preferences",
        token: "prefersColorScheme",
        value: prevPref,
      };
    } else {
      const token = normalizeTokenName(rawCommand.token);
      const isRemoval = rawCommand.value === null || rawCommand.value === undefined || String(rawCommand.value).trim() === "";
      if (token === "--grex-focus-ring" && isRemoval) {
        throw new GrexSecurityError("--grex-focus-ring cannot be removed or set to empty.");
      }
      const targetMap =
        mode === "base"
          ? nextThemeConfig.tokens
          : (nextThemeConfig.modes[mode] = nextThemeConfig.modes[mode] || {});
      const prevVal = token in targetMap ? targetMap[token] : null;
      if (isRemoval) {
        delete targetMap[token];
      } else {
        targetMap[token] = validateTokenValue(rawCommand.value);
      }
      inverse = {
        type: "setThemeToken",
        mode,
        token,
        value: prevVal,
      };
    }
  } else if (type === "upsertClass") {
    const action = String(rawCommand.action || "");
    const name = assertValidClassSlug(rawCommand.name);

    switch (action) {
      case "create": {
        if (name in nextClassRegistry) {
          throw new GrexSecurityError(`Class "${name}" already exists.`);
        }
        nextClassRegistry[name] = normalizeBreakpointStyleMap(rawCommand.styles || {});
        inverse = {
          type: "upsertClass",
          action: "delete",
          name,
        };
        break;
      }

      case "rename": {
        if (!(name in nextClassRegistry)) {
          throw new GrexSecurityError(`Class "${name}" not found for rename.`);
        }
        const nextName = assertValidClassSlug(rawCommand.nextName);
        if (nextName !== name && nextName in nextClassRegistry) {
          throw new GrexSecurityError(`Target class "${nextName}" already exists.`);
        }
        if (nextName !== name) {
          nextClassRegistry[nextName] = nextClassRegistry[name];
          delete nextClassRegistry[name];
          const oldTok = `${CLASS_PREFIX}${name}`;
          const newTok = `${CLASS_PREFIX}${nextName}`;
          for (const slotRoot of Object.values(nextSlots)) {
            walkSlotNodes(slotRoot, (node) => {
              const toks = getClassTokens(node);
              if (toks.includes(oldTok)) {
                setClassTokens(
                  node,
                  toks.map((t) => (t === oldTok ? newTok : t))
                );
              }
            });
          }
        }
        inverse = {
          type: "upsertClass",
          action: "rename",
          name: nextName,
          nextName: name,
        };
        break;
      }

      case "duplicate": {
        if (!(name in nextClassRegistry)) {
          throw new GrexSecurityError(`Class "${name}" not found for duplicate.`);
        }
        const nextName = assertValidClassSlug(rawCommand.nextName);
        if (nextName in nextClassRegistry) {
          throw new GrexSecurityError(`Target class "${nextName}" already exists.`);
        }
        nextClassRegistry[nextName] = cloneJson(nextClassRegistry[name]);
        inverse = {
          type: "upsertClass",
          action: "delete",
          name: nextName,
        };
        break;
      }

      case "delete": {
        if (!(name in nextClassRegistry)) {
          throw new GrexSecurityError(`Class "${name}" not found for delete.`);
        }
        const prevStyles = cloneJson(nextClassRegistry[name]);
        delete nextClassRegistry[name];
        const targetTok = `${CLASS_PREFIX}${name}`;
        const affectedNodes = [];
        for (const [slotKey, slotRoot] of Object.entries(nextSlots)) {
          walkSlotNodes(slotRoot, (node) => {
            const toks = getClassTokens(node);
            if (toks.includes(targetTok)) {
              setClassTokens(
                node,
                toks.filter((t) => t !== targetTok)
              );
              affectedNodes.push({ slot: slotKey, nodeId: getNodeId(node) });
            }
          });
        }
        inverse = {
          type: "upsertClass",
          action: "restore",
          name,
          styles: prevStyles,
          affectedNodes,
        };
        break;
      }

      case "restore": {
        nextClassRegistry[name] = normalizeBreakpointStyleMap(rawCommand.styles || {});
        const targetTok = `${CLASS_PREFIX}${name}`;
        for (const ref of rawCommand.affectedNodes || []) {
          const slotRoot = nextSlots[ref.slot];
          const loc = slotRoot ? findNodeLocation(slotRoot, ref.nodeId) : null;
          if (loc) {
            const toks = getClassTokens(loc.node);
            if (!toks.includes(targetTok)) {
              setClassTokens(loc.node, [...toks, targetTok]);
            }
          }
        }
        inverse = {
          type: "upsertClass",
          action: "delete",
          name,
        };
        break;
      }

      default:
        throw new GrexSecurityError(`Unsupported upsertClass action "${action}".`);
    }
  } else if (type === "assignClass") {
    const slot = String(rawCommand.slot || "");
    const nodeId = String(rawCommand.nodeId || "");
    const className = assertValidClassSlug(rawCommand.className);
    const attached = Boolean(rawCommand.attached);
    if (!nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${slot}".`);
    }
    touchedSlot = slot;
    const loc = findNodeLocation(nextSlots[slot], nodeId);
    if (!loc) {
      throw new GrexSecurityError(`Node "${nodeId}" not found for assignClass.`);
    }
    const tok = `${CLASS_PREFIX}${className}`;
    const toks = getClassTokens(loc.node);
    const wasAttached = toks.includes(tok);
    if (attached && !wasAttached) {
      setClassTokens(loc.node, [...toks, tok]);
    } else if (!attached && wasAttached) {
      setClassTokens(
        loc.node,
        toks.filter((t) => t !== tok)
      );
    }
    inverse = {
      type: "assignClass",
      slot,
      nodeId,
      className,
      attached: wasAttached,
    };
  } else if (type === "setBreakpointStyle") {
    const target = String(rawCommand.target || "node");
    const breakpoint = String(rawCommand.breakpoint || "base");
    if (!VALID_BREAKPOINTS.includes(breakpoint)) {
      throw new GrexSecurityError(`Invalid breakpoint "${breakpoint}".`);
    }
    const patch = rawCommand.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new GrexSecurityError("setBreakpointStyle requires a non-null patch object.");
    }

    const normalizedPatch = {};
    for (const [rawProp, rawVal] of Object.entries(patch)) {
      const cleanProp = normalizeStyleProperty(rawProp);
      if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "") {
        normalizedPatch[cleanProp] = null;
      } else {
        normalizedPatch[cleanProp] = validateTokenValue(rawVal);
      }
    }

    if (target === "class") {
      const className = assertValidClassSlug(rawCommand.className);
      if (!(className in nextClassRegistry)) {
        throw new GrexSecurityError(`Unregistered class "${className}" for setBreakpointStyle.`);
      }
      const clsStyles = cloneJson(nextClassRegistry[className] || {});
      const prevPatch = capturePreviousStyles(clsStyles, { [breakpoint]: normalizedPatch })[breakpoint] || {};
      const nextStyles = applyStylesPatch(clsStyles, { [breakpoint]: normalizedPatch });
      nextClassRegistry[className] = nextStyles;
      inverse = {
        type: "setBreakpointStyle",
        target: "class",
        className,
        breakpoint,
        patch: prevPatch,
      };
    } else if (target === "node") {
      const slot = String(rawCommand.slot || "");
      const nodeId = String(rawCommand.nodeId || "");
      if (!nextSlots[slot]) {
        throw new GrexSecurityError(`Unknown template slot "${slot}".`);
      }
      touchedSlot = slot;
      const loc = findNodeLocation(nextSlots[slot], nodeId);
      if (!loc) {
        throw new GrexSecurityError(`Node "${nodeId}" not found for setBreakpointStyle.`);
      }
      const prevPatch = capturePreviousStyles(loc.node.styles, { [breakpoint]: normalizedPatch })[breakpoint] || {};
      const nextStyles = applyStylesPatch(loc.node.styles, { [breakpoint]: normalizedPatch });
      if (Object.keys(nextStyles).length === 0) {
        delete loc.node.styles;
      } else {
        loc.node.styles = nextStyles;
      }
      inverse = {
        type: "setBreakpointStyle",
        target: "node",
        slot,
        nodeId,
        breakpoint,
        patch: prevPatch,
      };
    } else {
      throw new GrexSecurityError(`Unsupported setBreakpointStyle target "${target}".`);
    }
  } else if (type === "setTemplateConditions") {
    const templateId = String(rawCommand.templateId || "").trim();
    const tpl = nextTemplateRegistry.find((t) => t.id === templateId);
    if (!tpl) {
      throw new GrexSecurityError(`Template "${templateId}" not found for setTemplateConditions.`);
    }
    const prevConditions = cloneJson(tpl.conditions || []);
    const prevPriority = tpl.priority;
    tpl.conditions = normalizeTemplateConditions(rawCommand.conditions || []);
    if (rawCommand.priority !== undefined) {
      const pNum = Number(rawCommand.priority);
      if (!Number.isInteger(pNum)) {
        throw new GrexSecurityError(`Template priority must be an integer; got "${String(rawCommand.priority)}".`);
      }
      tpl.priority = pNum;
    }
    inverse = {
      type: "setTemplateConditions",
      templateId,
      conditions: prevConditions,
      priority: prevPriority,
    };
  } else if (type === "upsertTemplate") {
    const action = String(rawCommand.action || "create");
    const templateId = String(rawCommand.templateId || rawCommand.template?.id || "").trim();
    if (!templateId || !/^[a-z0-9_-]+$/i.test(templateId)) {
      throw new GrexSecurityError(`Invalid templateId "${templateId}".`);
    }
    if (action === "create") {
      if (nextTemplateRegistry.some((t) => t.id === templateId)) {
        throw new GrexSecurityError(`Template "${templateId}" already exists.`);
      }
      const spec = rawCommand.template || rawCommand;
      const slot = String(spec.slot || "single").trim();
      const treeSlot = String(spec.treeSlot || (slot === "header" || slot === "footer" ? `part:${slot}` : slot));
      const newTpl = {
        id: templateId,
        name: String(spec.name || templateId).trim(),
        slot,
        priority: Number.isInteger(Number(spec.priority)) ? Number(spec.priority) : 20,
        conditions: normalizeTemplateConditions(spec.conditions || []),
        treeSlot,
      };
      if (spec.tree) {
        const normTree = normalizeStudioNode(spec.tree, templateId);
        validateStudioNode(normTree, extractPartsMap(nextSlots));
        newTpl.tree = normTree;
      }
      nextTemplateRegistry.push(newTpl);
      inverse = {
        type: "upsertTemplate",
        action: "delete",
        templateId,
      };
    } else if (action === "delete") {
      const idx = nextTemplateRegistry.findIndex((t) => t.id === templateId);
      if (idx === -1) {
        throw new GrexSecurityError(`Template "${templateId}" not found for delete.`);
      }
      const removed = cloneJson(nextTemplateRegistry[idx]);
      nextTemplateRegistry.splice(idx, 1);
      inverse = {
        type: "upsertTemplate",
        action: "create",
        templateId,
        template: removed,
      };
    } else {
      throw new GrexSecurityError(`Unsupported upsertTemplate action "${action}".`);
    }
  } else if (type === "configureQueryLoop") {
    const slot = String(rawCommand.slot || "home");
    const nodeId = String(rawCommand.nodeId || "");
    if (!nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${slot}".`);
    }
    touchedSlot = slot;
    const loc = findNodeLocation(nextSlots[slot], nodeId);
    if (!loc) {
      throw new GrexSecurityError(`Node "${nodeId}" not found for configureQueryLoop.`);
    }
    const elType = getNodeElementType(loc.node);
    if (!["Grid", "Stack", "Section", "ForEach"].includes(elType)) {
      throw new GrexSecurityError(`Query Loop requires Grid, Stack, Section, or ForEach; got "${elType}".`);
    }
    const prevQueryLoop = loc.node.queryLoop ? cloneJson(loc.node.queryLoop) : null;
    if (rawCommand.queryLoop === null) {
      delete loc.node.queryLoop;
      if (elType === "ForEach" && loc.node.props) {
        delete loc.node.props.query;
      }
    } else {
      const normalized = normalizeQueryLoopConfig(rawCommand.queryLoop || {});
      loc.node.queryLoop = normalized;
      if (elType === "ForEach") {
        loc.node.props = loc.node.props || {};
        loc.node.props.query = {
          content_type: normalized.content_type,
          per_page: String(normalized.per_page),
          sort_by: normalized.order_by,
          sort_dir: normalized.order_dir,
          ...(normalized.filter_by_term ? { filter_by_term: normalized.filter_by_term } : {}),
        };
      }
    }
    inverse = {
      type: "configureQueryLoop",
      slot,
      nodeId,
      queryLoop: prevQueryLoop,
    };
  } else if (type === "bindDynamicField") {
    const slot = String(rawCommand.slot || "home");
    const nodeId = String(rawCommand.nodeId || "");
    const prop = String(rawCommand.prop || "text").trim();
    if (!["text", "label", "title", "alt", "href", "src"].includes(prop)) {
      throw new GrexSecurityError(`Unsupported dynamic binding prop "${prop}".`);
    }
    if (!nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${slot}".`);
    }
    touchedSlot = slot;
    const loc = findNodeLocation(nextSlots[slot], nodeId);
    if (!loc) {
      throw new GrexSecurityError(`Node "${nodeId}" not found for bindDynamicField.`);
    }
    const token = rawCommand.token;
    if (typeof token === "string" && token !== "") {
      if ((prop === "href" || prop === "src") && !isSafeUrl(token) && !/^\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}$/.test(token.trim())) {
        throw new GrexSecurityError(`Unsafe URL in bindDynamicField.${prop}.`);
      }
      if (/<script\b|<iframe\b|<object\b|<div\b|\bon[a-z]+\s*=/i.test(token)) {
        throw new GrexSecurityError(`Unsafe markup in bindDynamicField.${prop}.`);
      }
    }
    loc.node.props = loc.node.props || {};
    const prevToken = prop in loc.node.props ? loc.node.props[prop] : null;
    if (token === null || token === undefined || token === "") {
      delete loc.node.props[prop];
      if (loc.node.bindings) {
        delete loc.node.bindings[prop];
        if (Object.keys(loc.node.bindings).length === 0) {
          delete loc.node.bindings;
        }
      }
    } else {
      loc.node.props[prop] = String(token);
      if (/\{\{.*\}\}|\{[a-zA-Z0-9_]+\}/.test(String(token))) {
        loc.node.bindings = { ...(loc.node.bindings || {}), [prop]: String(token) };
      } else if (loc.node.bindings) {
        delete loc.node.bindings[prop];
        if (Object.keys(loc.node.bindings).length === 0) {
          delete loc.node.bindings;
        }
      }
    }
    inverse = {
      type: "bindDynamicField",
      slot,
      nodeId,
      prop,
      token: prevToken,
    };
  } else if (type === "bindMediaAsset") {
    const slot = String(rawCommand.slot || "home");
    const nodeId = String(rawCommand.nodeId || "");
    if (!nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${slot}".`);
    }
    touchedSlot = slot;
    const loc = findNodeLocation(nextSlots[slot], nodeId);
    if (!loc) {
      throw new GrexSecurityError(`Node "${nodeId}" not found for bindMediaAsset.`);
    }
    if (getNodeElementType(loc.node) !== "Image") {
      throw new GrexSecurityError("bindMediaAsset requires an Image element.");
    }
    const isDecorative = Boolean(rawCommand.isDecorative);
    const alt = rawCommand.alt == null ? "" : String(rawCommand.alt).trim();
    const src = rawCommand.src == null ? "" : String(rawCommand.src).trim();
    if (!src || !isSafeUrl(src)) {
      throw new GrexSecurityError(`Unsafe or empty media URL "${src}" in bindMediaAsset.`);
    }
    if (!rawCommand._restore && !isDecorative && alt === "") {
      throw new GrexSecurityError(
        "GREX-A11Y-002: Non-decorative Image requires descriptive alt text or explicit isDecorative: true."
      );
    }
    loc.node.props = loc.node.props || {};
    const prev = loc.node.props;
    inverse = {
      type: "bindMediaAsset",
      slot,
      nodeId,
      mediaId: prev.mediaId ?? null,
      src: prev.src ?? "/static/grex/placeholder.png",
      alt: prev.alt ?? "",
      width: prev.width ?? null,
      height: prev.height ?? null,
      isDecorative: Boolean(prev.decorative || prev.is_decorative),
      _restore: true,
    };

    prev.src = src;
    prev.alt = isDecorative ? "" : alt;
    prev.decorative = isDecorative;
    prev.is_decorative = isDecorative;
    if (rawCommand.mediaId !== undefined && rawCommand.mediaId !== null) {
      prev.mediaId = rawCommand.mediaId;
    } else {
      delete prev.mediaId;
    }
    if (rawCommand.width !== undefined && rawCommand.width !== null && rawCommand.width !== "") {
      prev.width = rawCommand.width;
    } else {
      delete prev.width;
    }
    if (rawCommand.height !== undefined && rawCommand.height !== null && rawCommand.height !== "") {
      prev.height = rawCommand.height;
    } else {
      delete prev.height;
    }
  } else if (type === "bindNavigationMenu") {
    const slot = String(rawCommand.slot || "home");
    const nodeId = String(rawCommand.nodeId || "");
    const location = String(rawCommand.location || "primary").trim().toLowerCase();
    if (!["primary", "footer", "mobile"].includes(location)) {
      throw new GrexSecurityError(`Invalid menu location "${location}" (expected primary, footer, or mobile).`);
    }
    if (!nextSlots[slot]) {
      throw new GrexSecurityError(`Unknown template slot "${slot}".`);
    }
    touchedSlot = slot;
    const loc = findNodeLocation(nextSlots[slot], nodeId);
    if (!loc) {
      throw new GrexSecurityError(`Node "${nodeId}" not found for bindNavigationMenu.`);
    }
    if (getNodeElementType(loc.node) !== "Nav") {
      throw new GrexSecurityError("bindNavigationMenu requires a Nav element.");
    }
    loc.node.props = loc.node.props || {};
    const prevLocation = loc.node.props.location ?? null;
    const prevItems = loc.node.props.items ? cloneJson(loc.node.props.items) : null;
    loc.node.props.location = location;
    if (Array.isArray(rawCommand.items)) {
      loc.node.props.items = cloneJson(rawCommand.items);
    }
    inverse = {
      type: "bindNavigationMenu",
      slot,
      nodeId,
      location: prevLocation || "primary",
      items: prevItems,
    };
  }

  if (touchedSlot) {
    const partsMap = extractPartsMap(nextSlots);
    validateStudioNode(nextSlots[touchedSlot], partsMap);
  }

  const record = {
    command: cloneJson(rawCommand),
    inverse,
    actor: typeof meta.actor === "string" && meta.actor ? meta.actor : "designer",
    timestamp: new Date().toISOString(),
  };

  const nextState = {
    slots: nextSlots,
    themeConfig: nextThemeConfig,
    classRegistry: nextClassRegistry,
    templateRegistry: nextTemplateRegistry,
  };

  return { nextState, nextSlots, record };
}

/**
 * Backward-compatible v0.1 wrapper executing a tree command against `slots`.
 *
 * @param {Record<string, object>} slots
 * @param {object} rawCommand
 * @param {{ actor?: string }} [meta]
 * @returns {{ nextSlots: Record<string, object>, record: object }}
 */
export function executeTreeCommand(slots, rawCommand, meta = {}) {
  const { nextSlots, record } = executeBuilderCommand({ slots }, rawCommand, meta);
  return { nextSlots, record };
}

/**
 * Create a standalone serializable command history stack manager.
 * @param {{ maxHistory?: number }} [options]
 */
export function createCommandStack(options = {}) {
  const maxHistory = Number.isInteger(options.maxHistory) && options.maxHistory > 0
    ? options.maxHistory
    : DEFAULT_MAX_HISTORY;

  function createEmptyState() {
    return { undoStack: [], redoStack: [] };
  }

  function pushRecord(historyState, record) {
    const undoStack = [...(historyState?.undoStack || []), cloneJson(record)];
    if (undoStack.length > maxHistory) {
      undoStack.splice(0, undoStack.length - maxHistory);
    }
    return {
      undoStack,
      redoStack: [],
    };
  }

  function stepUndo(stateOrSlots, historyState) {
    const undoStack = [...(historyState?.undoStack || [])];
    if (undoStack.length === 0) {
      return null;
    }
    const entry = undoStack.pop();
    const isFullState = Boolean(stateOrSlots && typeof stateOrSlots === "object" && "slots" in stateOrSlots);
    const inputState = isFullState ? stateOrSlots : { slots: stateOrSlots };
    const { nextState, nextSlots } = executeBuilderCommand(inputState, entry.inverse, { actor: entry.actor });
    const redoStack = [...(historyState?.redoStack || []), entry];
    return {
      nextState,
      nextSlots,
      nextHistory: { undoStack, redoStack },
      entry,
    };
  }

  function stepRedo(stateOrSlots, historyState) {
    const redoStack = [...(historyState?.redoStack || [])];
    if (redoStack.length === 0) {
      return null;
    }
    const entry = redoStack.pop();
    const isFullState = Boolean(stateOrSlots && typeof stateOrSlots === "object" && "slots" in stateOrSlots);
    const inputState = isFullState ? stateOrSlots : { slots: stateOrSlots };
    const { nextState, nextSlots } = executeBuilderCommand(inputState, entry.command, { actor: entry.actor });
    const undoStack = [...(historyState?.undoStack || []), entry];
    return {
      nextState,
      nextSlots,
      nextHistory: { undoStack, redoStack },
      entry,
    };
  }

  return {
    createEmptyState,
    pushRecord,
    stepUndo,
    stepRedo,
  };
}
