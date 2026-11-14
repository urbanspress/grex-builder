/**
 * Grex Theme Builder — Deterministic Undo/Redo Command Stack (v0.1).
 * Every mutation executes as a JSON-serializable command with an exact inverse,
 * shared identically by human designers and Groxy AI (`grab mcp`).
 */

import { GrexSecurityError } from "./grex.js";
import {
  cloneJson,
  extractPartsMap,
  getNodeId,
  normalizeStudioNode,
  validateStudioNode,
} from "./schema.js";

export const COMMAND_TYPES = Object.freeze([
  "insertNode",
  "deleteNode",
  "moveNode",
  "updateProps",
  "updateStyles",
  "replaceTree",
]);

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
 * Execute a deterministic command against a cloned `slots` map and return
 * `{ nextSlots, record }`, where `record` contains serializable `command` & `inverse`.
 * Rejects invalid/unsafe mutations with `GrexSecurityError` or `Error` before returning.
 *
 * @param {Record<string, object>} slots
 * @param {object} rawCommand
 * @param {{ actor?: string }} [meta]
 * @returns {{ nextSlots: Record<string, object>, record: object }}
 */
export function executeTreeCommand(slots, rawCommand, meta = {}) {
  if (!rawCommand || typeof rawCommand !== "object") {
    throw new GrexSecurityError("Builder command must be a non-null object.");
  }
  const { type, slot } = rawCommand;
  if (!COMMAND_TYPES.includes(type)) {
    throw new GrexSecurityError(`Unsupported builder command type "${String(type)}".`);
  }
  if (typeof slot !== "string" || !slots || !slots[slot]) {
    throw new GrexSecurityError(`Unknown template slot "${String(slot)}".`);
  }

  const nextSlots = cloneJson(slots);
  const root = nextSlots[slot];
  let inverse = null;

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

  const partsMap = extractPartsMap(nextSlots);
  validateStudioNode(nextSlots[slot], partsMap);

  const record = {
    command: cloneJson(rawCommand),
    inverse,
    actor: typeof meta.actor === "string" && meta.actor ? meta.actor : "designer",
    timestamp: new Date().toISOString(),
  };

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

  function stepUndo(slots, historyState) {
    const undoStack = [...(historyState?.undoStack || [])];
    if (undoStack.length === 0) {
      return null;
    }
    const entry = undoStack.pop();
    const { nextSlots } = executeTreeCommand(slots, entry.inverse, { actor: entry.actor });
    const redoStack = [...(historyState?.redoStack || []), entry];
    return {
      nextSlots,
      nextHistory: { undoStack, redoStack },
      entry,
    };
  }

  function stepRedo(slots, historyState) {
    const redoStack = [...(historyState?.redoStack || [])];
    if (redoStack.length === 0) {
      return null;
    }
    const entry = redoStack.pop();
    const { nextSlots } = executeTreeCommand(slots, entry.command, { actor: entry.actor });
    const undoStack = [...(historyState?.undoStack || []), entry];
    return {
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
