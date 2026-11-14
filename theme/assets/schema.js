/**
 * Grex Theme Builder — Schema Adapter, 20-Element Catalog & Security/A11y Validator.
 * Bridges GrabLab CMS v1.0.0 (`element`, `grex.elements.json`) and Grex JS v1.0.0
 * (`type`, `validateElementNode`, `auditAccessibility`, `exportElementCatalog`).
 */

import {
  exportElementCatalog,
  validateElementNode,
  auditAccessibility,
  GrexSecurityError,
  isSafeUrl,
  sanitizeAttributeValue,
  normalizeStyleProperty,
  validateTokenValue,
} from "./grex.js";

export const MAX_NESTING_DEPTH = 24;
export const REQUIRED_SLOTS = Object.freeze(["home", "single", "archive", "404"]);
export const ALL_TEMPLATE_SLOTS = Object.freeze(["home", "single", "archive", "search", "404"]);

const FORBIDDEN_TAGS = new Set([
  "div",
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "style",
  "base",
  "meta",
  "link",
]);

const CATALOG = exportElementCatalog();
export const ELEMENT_CATALOG = CATALOG;
export const SUPPORTED_ELEMENT_TYPES = Object.freeze(Object.keys(CATALOG.elements));
export const SUPPORTED_STYLE_PROPS = Object.freeze(
  CATALOG.elements.Section.supportedStyleProps.slice()
);

const DEFAULT_TAG_MAP = Object.freeze({
  Fragment: "section",
  TemplatePart: "section",
  Section: "section",
  Container: "section",
  Grid: "section",
  Stack: "section",
  Card: "article",
  Heading: "h2",
  Text: "p",
  RichText: "p",
  Link: "a",
  Button: "button",
  Image: "img",
  Icon: "svg",
  Form: "form",
  Input: "label",
  Select: "label",
  Tabs: "section",
  Accordion: "section",
  Modal: "dialog",
  Nav: "nav",
  ForEach: "ul",
});

/**
 * Deep-clone plain JSON-serializable values.
 * @template T
 * @param {T} val
 * @returns {T}
 */
export function cloneJson(val) {
  return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
}

/**
 * Generate a deterministic-friendly unique node ID.
 * @param {string} prefix
 * @returns {string}
 */
export function createNodeId(prefix = "node") {
  const clean = String(prefix || "node")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "node";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${clean}-${rand}`;
}

/**
 * Resolve canonical element type from either `node.element` (GrabLab) or `node.type` (Grex JS).
 * @param {object} node
 * @returns {string}
 */
export function getNodeElementType(node) {
  if (!node || typeof node !== "object") {
    return "";
  }
  return String(node.element || node.type || "").trim();
}

/**
 * Resolve node ID from `node.id` or `node.props.id`.
 * @param {object} node
 * @returns {string}
 */
export function getNodeId(node) {
  if (!node || typeof node !== "object") {
    return "";
  }
  if (typeof node.id === "string" && node.id.trim() !== "") {
    return node.id.trim();
  }
  if (node.props && typeof node.props.id === "string" && node.props.id.trim() !== "") {
    return node.props.id.trim();
  }
  return "";
}

/**
 * Resolve the effective HTML tag for a node.
 * @param {object} node
 * @returns {string}
 */
export function getNodeTag(node) {
  const elType = getNodeElementType(node);
  if (typeof node?.tag === "string" && node.tag.trim() !== "") {
    return node.tag.trim().toLowerCase();
  }
  if (elType === "Heading") {
    const lvl = Number(node?.props?.level ?? 2);
    if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 6) {
      return `h${lvl}`;
    }
  }
  return DEFAULT_TAG_MAP[elType] || "section";
}

function isBindingToken(val) {
  return (
    typeof val === "string" &&
    (/^\{[a-zA-Z0-9_]+\}$/.test(val.trim()) || /^\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}$/.test(val.trim()))
  );
}

/**
 * Enforce security invariants on a raw node (no <div>, no <script>, no on* props,
 * no innerHTML, no unsafe URLs, depth <= 24).
 * @param {object} node
 * @param {number} [depth]
 */
export function assertNodeSecurityInvariants(node, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) {
    throw new GrexSecurityError(`Grex layout nesting exceeds maximum depth (${MAX_NESTING_DEPTH}).`);
  }
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new GrexSecurityError("Grex node must be a non-null object.");
  }

  const elType = getNodeElementType(node);
  const isWrapperAllowed = elType === "Fragment" || elType === "TemplatePart";
  if (!isWrapperAllowed && !(elType in CATALOG.elements)) {
    throw new GrexSecurityError(`Unsupported or unknown Grex element "${elType}".`);
  }

  if (node.tag !== undefined && node.tag !== null && node.tag !== "") {
    const tag = String(node.tag).trim().toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) {
      throw new GrexSecurityError(`Disallowed HTML tag "<${tag}>" rejected by Grex security policy.`);
    }
    if (!isWrapperAllowed) {
      const def = CATALOG.elements[elType];
      if (!def.allowedTags.includes(tag)) {
        throw new GrexSecurityError(
          `Tag "<${tag}>" is not allowed on ${elType} (allowed: ${def.allowedTags.join(", ")}).`
        );
      }
    }
  }

  const props = node.props || {};
  if (typeof props !== "object" || Array.isArray(props)) {
    throw new GrexSecurityError(`${elType}.props must be an object.`);
  }

  for (const [k, v] of Object.entries(props)) {
    const kl = k.toLowerCase();
    if (kl.startsWith("on") || kl === "srcdoc") {
      throw new GrexSecurityError(`Forbidden event/handler prop "${k}" blocked by Grex XSS policy.`);
    }
    if (kl === "innerhtml" || kl === "outerhtml" || kl === "dangerouslysetinnerhtml") {
      throw new GrexSecurityError(`Unsafe HTML sink prop "${k}" blocked by Grex XSS policy.`);
    }
    if ((kl === "href" || kl === "src" || kl === "action" || kl === "formaction") && typeof v === "string") {
      if (!isSafeUrl(v) && !isBindingToken(v)) {
        throw new GrexSecurityError(`Unsafe URL in ${elType}.props.${k}.`);
      }
    }
    if ((kl === "text" || kl === "html" || kl === "content") && typeof v === "string") {
      if (/<script\b|<iframe\b|<object\b|<div\b|\bon[a-z]+\s*=/i.test(v)) {
        throw new GrexSecurityError(`Unsafe inline HTML/script markup inside ${elType}.props.${k}.`);
      }
    }
  }

  if (node.attrs && typeof node.attrs === "object") {
    for (const [ak, av] of Object.entries(node.attrs)) {
      sanitizeAttributeValue(ak, av);
    }
  }

  if (node.styles && typeof node.styles === "object") {
    const bpMap =
      "base" in node.styles || "tablet" in node.styles || "mobile" in node.styles
        ? node.styles
        : { base: node.styles };
    for (const styleObj of Object.values(bpMap)) {
      if (styleObj && typeof styleObj === "object") {
        for (const [prop, val] of Object.entries(styleObj)) {
          normalizeStyleProperty(prop);
          validateTokenValue(val);
        }
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      assertNodeSecurityInvariants(child, depth + 1);
    }
  }
}

/**
 * Convert a GrabLab or studio node into a strict Grex JS v1.0.0 GrexElementNode
 * suitable for `validateElementNode()`, `auditAccessibility()`, `compileElementStyles()`, and `renderNode()`.
 *
 * @param {object} node
 * @param {Record<string, object>} [partsMap]
 * @param {number} [depth]
 * @returns {object}
 */
export function toGrexJsNode(node, partsMap = {}, depth = 0) {
  assertNodeSecurityInvariants(node, depth);

  const elType = getNodeElementType(node);
  const rawProps = { ...(node.props || {}) };
  const attrs = { ...(node.attrs || {}) };
  const nodeId = getNodeId(node) || undefined;

  if (typeof rawProps["aria-label"] === "string" && !attrs["aria-label"]) {
    attrs["aria-label"] = rawProps["aria-label"];
  }
  if (typeof rawProps.class === "string" && !attrs.class) {
    attrs.class = rawProps.class;
  }

  if (elType === "TemplatePart") {
    const partName = String(rawProps.name || "").trim();
    if (partName && partsMap && partsMap[partName]) {
      return toGrexJsNode(partsMap[partName], partsMap, depth + 1);
    }
    return {
      type: "Section",
      id: nodeId,
      tag: "section",
      props: { label: partName ? `Template part ${partName}` : "Template part" },
      attrs,
      styles: node.styles ? cloneJson(node.styles) : undefined,
      children: [],
    };
  }

  const mappedType = elType === "Fragment" ? "Section" : elType;
  const def = CATALOG.elements[mappedType];
  const props = {};

  for (const [k, v] of Object.entries(rawProps)) {
    if (k === "id" || k === "class" || k === "aria-label" || k === "mediaId") {
      continue;
    }
    if (k === "is_decorative") {
      props.decorative = Boolean(v);
      if (v) {
        attrs["aria-hidden"] = "true";
      }
      continue;
    }
    if (k === "decorative") {
      props.decorative = Boolean(v);
      if (v) {
        attrs["aria-hidden"] = "true";
      }
      continue;
    }
    if (mappedType === "Nav" && k === "location") {
      if (!props.label) {
        props.label = `Navigation (${String(v)})`;
      }
      continue;
    }
    if (mappedType === "ForEach" && k === "query") {
      continue;
    }
    if (k in def.props) {
      props[k] = v;
    } else if (mappedType === "Text" && k === "content") {
      props.text = v;
    }
  }

  if (mappedType === "Nav" && !Array.isArray(props.items)) {
    props.items = [];
  }
  if (mappedType === "ForEach") {
    if (props.items === undefined) {
      props.items = [];
    }
    if (typeof props.key !== "function") {
      props.key = (item, idx) => (item && item.id != null ? item.id : idx);
    }
    if (typeof props.render !== "function") {
      props.render = () => null;
    }
  }
  if (mappedType === "Select" && !Array.isArray(props.options)) {
    props.options = [];
  }
  if (mappedType === "Tabs" && !Array.isArray(props.tabs)) {
    props.tabs = [];
  }
  if (mappedType === "Accordion" && !Array.isArray(props.items)) {
    props.items = [];
  }
  if (mappedType === "Modal" && props.open === undefined) {
    props.open = false;
  }

  const children = Array.isArray(node.children)
    ? node.children.map((ch) => toGrexJsNode(ch, partsMap, depth + 1))
    : undefined;

  const grexNode = {
    type: mappedType,
    props,
  };
  if (nodeId) {
    grexNode.id = nodeId;
  }
  if (mappedType === "Heading") {
    const lvl = Number(props.level ?? 2);
    if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 6) {
      props.level = lvl;
      grexNode.tag = `h${lvl}`;
    }
  } else if (elType !== "Fragment" && node.tag) {
    grexNode.tag = String(node.tag).trim().toLowerCase();
  } else if (elType === "Fragment") {
    grexNode.tag = "section";
  }
  if (Object.keys(attrs).length > 0) {
    grexNode.attrs = attrs;
  }
  if (node.styles && typeof node.styles === "object") {
    grexNode.styles = cloneJson(node.styles);
  }
  if (children && children.length > 0) {
    grexNode.children = children;
  }

  return grexNode;
}

/**
 * Convert a studio / Grex node into GrabLab CMS `grex.elements.json` format (`element`, `props`, etc.).
 * Ensures every node carries an explicit `id` for deterministic command operations and preview patching.
 *
 * @param {object} node
 * @param {string} [fallbackPrefix]
 * @returns {object}
 */
export function normalizeStudioNode(node, fallbackPrefix = "el") {
  assertNodeSecurityInvariants(node, 0);
  const elType = getNodeElementType(node);
  const id = getNodeId(node) || createNodeId(elType || fallbackPrefix);
  const props = { ...(node.props || {}), id };

  if (node.attrs && typeof node.attrs === "object") {
    if (typeof node.attrs["aria-label"] === "string" && !props["aria-label"]) {
      props["aria-label"] = node.attrs["aria-label"];
    }
    if (typeof node.attrs.class === "string" && !props.class) {
      props.class = node.attrs.class;
    }
  }
  if (typeof node.className === "string" && !props.class) {
    props.class = node.className;
  }
  if (props.decorative === true && props.is_decorative === undefined) {
    props.is_decorative = true;
  }

  const out = {
    id,
    element: elType,
    props,
  };
  if (node.tag) {
    out.tag = String(node.tag).trim().toLowerCase();
  }
  if (node.styles && typeof node.styles === "object" && Object.keys(node.styles).length > 0) {
    out.styles = cloneJson(node.styles);
  }
  if (node.queryLoop && typeof node.queryLoop === "object") {
    out.queryLoop = cloneJson(node.queryLoop);
  }
  if (node.bindings && typeof node.bindings === "object" && Object.keys(node.bindings).length > 0) {
    out.bindings = cloneJson(node.bindings);
  }
  if (Array.isArray(node.children)) {
    out.children = node.children.map((child, idx) =>
      normalizeStudioNode(child, `${elType.toLowerCase()}-${idx}`)
    );
  }
  return out;
}

/**
 * Flatten a `grex.elements.json` document into a normalized slot map:
 * `{ home, single, archive, search, 404, "part:header", ... }`.
 *
 * @param {object} doc
 * @returns {Record<string, object>}
 */
export function normalizeSlotDocument(doc) {
  if (!doc || typeof doc !== "object") {
    throw new GrexSecurityError("grex.elements.json must be an object.");
  }
  const templates = doc.templates && typeof doc.templates === "object" ? doc.templates : doc;
  const slots = {};

  for (const [slotName, node] of Object.entries(templates)) {
    if (
      slotName === "parts" ||
      slotName === "schemaVersion" ||
      slotName === "engine" ||
      slotName === "theme" ||
      slotName === "classes"
    ) {
      continue;
    }
    if (node && typeof node === "object" && getNodeElementType(node)) {
      slots[slotName] = normalizeStudioNode(node, slotName);
    }
  }

  if (doc.parts && typeof doc.parts === "object") {
    for (const [partName, node] of Object.entries(doc.parts)) {
      if (node && typeof node === "object" && getNodeElementType(node)) {
        slots[`part:${partName}`] = normalizeStudioNode(node, `part-${partName}`);
      }
    }
  }

  for (const reqSlot of REQUIRED_SLOTS) {
    if (!slots[reqSlot]) {
      throw new GrexSecurityError(`grex.elements.json missing required template slot "${reqSlot}".`);
    }
  }

  return slots;
}

/**
 * Strip studio-only helper fields and emit a clean GrabLab CMS `grex.elements.json` document.
 * @param {object} node
 * @returns {object}
 */
function stripForGrabLabExport(node) {
  const out = {
    element: getNodeElementType(node),
  };
  if (node.tag) {
    out.tag = node.tag;
  }
  const props = { ...(node.props || {}) };
  const nid = getNodeId(node);
  if (nid) {
    props.id = nid;
  }
  if (props.decorative === true) {
    props.is_decorative = true;
    delete props.decorative;
  }
  if (Object.keys(props).length > 0) {
    out.props = props;
  }
  if (node.styles && typeof node.styles === "object" && Object.keys(node.styles).length > 0) {
    out.styles = cloneJson(node.styles);
  }
  if (node.queryLoop && typeof node.queryLoop === "object") {
    out.queryLoop = cloneJson(node.queryLoop);
  }
  if (node.bindings && typeof node.bindings === "object" && Object.keys(node.bindings).length > 0) {
    out.bindings = cloneJson(node.bindings);
  }
  if (Array.isArray(node.children) && node.children.length > 0) {
    out.children = node.children.map(stripForGrabLabExport);
  }
  return out;
}

/**
 * Export normalized slot map (plus optional v0.2 theme & classes) back to GrabLab CMS `grex.elements.json` document.
 * @param {Record<string, object>} slots
 * @param {{ theme?: object, classes?: Record<string, object> }} [extra]
 * @returns {object}
 */
export function exportGrabLabDocument(slots, extra = {}) {
  const templates = {};
  const parts = {};
  for (const [key, node] of Object.entries(slots || {})) {
    if (!node) {
      continue;
    }
    if (key.startsWith("part:")) {
      parts[key.slice(5)] = stripForGrabLabExport(node);
    } else {
      templates[key] = stripForGrabLabExport(node);
    }
  }
  const doc = {
    schemaVersion: "1.0.0",
    engine: "grex-visual",
    parts,
    templates,
  };
  if (extra && extra.theme && typeof extra.theme === "object") {
    doc.theme = cloneJson(extra.theme);
  }
  if (extra && extra.classes && typeof extra.classes === "object" && Object.keys(extra.classes).length > 0) {
    doc.classes = cloneJson(extra.classes);
  }
  if (extra && Array.isArray(extra.templateRegistry) && extra.templateRegistry.length > 0) {
    doc.templateRegistry = cloneJson(extra.templateRegistry);
  }
  return doc;
}

/**
 * Extract clean `.grex-c-*` reusable class names attached to a node.
 * @param {object} node
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function getNodeGrexClasses(node, prefix = "grex-c-") {
  if (!node || typeof node !== "object") {
    return [];
  }
  const rawClass = String(node.props?.class || node.attrs?.class || "").trim();
  const tokens = rawClass ? rawClass.split(/\s+/).filter(Boolean) : [];
  const out = [];
  const seen = new Set();
  for (const tok of tokens) {
    if (tok.startsWith(prefix)) {
      const clean = tok.slice(prefix.length);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
  }
  if (Array.isArray(node.classes)) {
    for (const c of node.classes) {
      const clean = String(c || "").replace(new RegExp(`^${prefix}`), "").trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
  }
  return out;
}

/**
 * Validate a single node using both Grex security invariants and `Grex JS v1.0.0` `validateElementNode()`.
 * @param {object} node
 * @param {Record<string, object>} [partsMap]
 * @returns {{ valid: true }}
 */
export function validateStudioNode(node, partsMap = {}) {
  assertNodeSecurityInvariants(node, 0);
  const grexNode = toGrexJsNode(node, partsMap, 0);
  return validateElementNode(grexNode, { strictProps: true });
}

/**
 * Validate + audit accessibility (`validateElementNode()` + `auditAccessibility()`) on a slot tree.
 * @param {object} rootNode
 * @param {Record<string, object>} [partsMap]
 * @returns {{ ok: boolean, valid: boolean, a11yOk: boolean, errors: Array<{ code: string, nodeId?: string, message: string }>, warnings: Array<{ code: string, nodeId?: string, message: string }>, issues: Array<object> }}
 */
export function evaluateSlotDiagnostics(rootNode, partsMap = {}) {
  const errors = [];
  const warnings = [];
  let valid = true;

  try {
    validateStudioNode(rootNode, partsMap);
  } catch (err) {
    valid = false;
    errors.push({
      code: "GREX-SCHEMA-001",
      nodeId: getNodeId(rootNode) || undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let a11yResult = { ok: false, issues: [] };
  if (valid) {
    const checkImagesAlt = (n) => {
      if (!n || typeof n !== "object") {
        return;
      }
      if (getNodeElementType(n) === "Image") {
        const p = n.props || {};
        const isDec = Boolean(p.decorative || p.is_decorative);
        const alt = typeof p.alt === "string" ? p.alt.trim() : "";
        if (!isDec && alt === "") {
          errors.push({
            code: "GREX-A11Y-002",
            nodeId: getNodeId(n) || undefined,
            message: "Non-decorative Image requires descriptive alt text or explicit decorative flag.",
          });
        }
      }
      if (Array.isArray(n.children)) {
        for (const ch of n.children) {
          checkImagesAlt(ch);
        }
      }
    };
    checkImagesAlt(rootNode);

    const grexTree = toGrexJsNode(rootNode, partsMap, 0);
    a11yResult = auditAccessibility(grexTree, { defaultBg: "#ffffff" });
    for (const issue of a11yResult.issues) {
      if (issue.severity === "error") {
        if (!errors.some((e) => e.code === "GREX-A11Y-002" && e.nodeId === issue.nodeId && issue.code === "GREX-A11Y-002")) {
          errors.push({ code: issue.code, nodeId: issue.nodeId, message: issue.message });
        }
      } else {
        warnings.push({ code: issue.code, nodeId: issue.nodeId, message: issue.message });
      }
    }
  }

  return {
    ok: valid && errors.length === 0,
    valid,
    a11yOk: valid && a11yResult.ok,
    errors,
    warnings,
    issues: [...errors.map((e) => ({ ...e, severity: "error" })), ...warnings.map((w) => ({ ...w, severity: "warning" }))],
  };
}

/**
 * Extract `parts` map from a flat slot map (`part:header` -> `header`).
 * @param {Record<string, object>} slots
 * @returns {Record<string, object>}
 */
export function extractPartsMap(slots) {
  const parts = {};
  for (const [k, v] of Object.entries(slots || {})) {
    if (k.startsWith("part:") && v) {
      parts[k.slice(5)] = v;
    }
  }
  return parts;
}

/**
 * Create a clean, accessible, spec-compliant default node for any of the 20 elements in `grex.elements.json`.
 * Guarantees every inserted node passes `validateElementNode()` and `auditAccessibility()` out of the box.
 *
 * @param {string} elementType
 * @returns {object}
 */
export function buildDefaultNodeForElement(elementType) {
  const def = CATALOG.elements[elementType];
  if (!def) {
    throw new GrexSecurityError(`Unknown Grex element type "${String(elementType)}".`);
  }
  const id = createNodeId(elementType);
  const base = {
    id,
    element: elementType,
    tag: def.defaultTag,
    props: { id },
  };

  switch (elementType) {
    case "Section":
    case "Container":
    case "Grid":
    case "Stack":
    case "Card":
      base.props.label = `${elementType} region`;
      base.children = [];
      return base;
    case "Heading":
      base.props.level = 2;
      base.props.text = "Section Heading";
      return base;
    case "Text":
      base.props.text = "Editable paragraph text.";
      return base;
    case "RichText":
      base.props.text = "Rich semantic text block.";
      return base;
    case "Link":
      base.props.href = "/";
      base.props.text = "Explore link";
      return base;
    case "Button":
      base.props.type = "button";
      base.props.text = "Action Button";
      return base;
    case "Image":
      base.props.src = "/static/grex/placeholder.png";
      base.props.alt = "Descriptive image text";
      base.props.decorative = false;
      return base;
    case "Icon":
      base.props.viewBox = "0 0 24 24";
      base.props.size = "24";
      base.props.decorative = true;
      base.props.paths = [{ tag: "circle", attrs: { cx: "12", cy: "12", r: "9", stroke: "currentColor", "stroke-width": "2" } }];
      return base;
    case "Form":
      base.props.action = "/api/submit";
      base.props.method = "post";
      base.props.requireCsrf = true;
      base.children = [];
      return base;
    case "Input":
      base.props.name = "field_name";
      base.props.label = "Field Label";
      base.props.type = "text";
      base.props.placeholder = "Enter value";
      return base;
    case "Select":
      base.props.name = "select_name";
      base.props.label = "Choose Option";
      base.props.options = [
        { value: "option-a", label: "Option A" },
        { value: "option-b", label: "Option B" },
      ];
      return base;
    case "Tabs":
      base.props.label = "Content Tabs";
      base.props.tabs = [
        { id: "tab-1", label: "Overview", content: "Overview panel content." },
        { id: "tab-2", label: "Details", content: "Details panel content." },
      ];
      return base;
    case "Accordion":
      base.props.items = [
        { id: "item-1", title: "Frequently Asked Question", content: "Clear accessible answer." },
      ];
      return base;
    case "Modal":
      base.props.open = false;
      base.props.title = "Dialog Title";
      base.children = [];
      return base;
    case "Nav":
      base.props.label = "Site Navigation";
      base.props.items = [
        { href: "/", text: "Home" },
        { href: "/about", text: "About" },
      ];
      return base;
    case "ForEach":
      base.props.class = "grex-card-grid";
      base.props.query = { per_page: "6", sort_by: "published_at", sort_dir: "desc" };
      return base;
    default:
      return base;
  }
}
