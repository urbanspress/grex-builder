/**
 * Grex Theme Builder v0.4 — `GRAB-DESIGN-SYSTEM.md` Generator & `grab mcp` AI Layout Guardrails.
 * Keeps Groxy AI aligned with active `--grex-*` tokens, `.grex-c-*` classes, zero-<div> semantics,
 * and strict WCAG AA + `validateElementNode()` enforcement.
 */

import {
  auditAccessibility,
  computeContrastRatio,
  GrexSecurityError,
} from "./grex.js";
import {
  ELEMENT_CATALOG,
  MAX_NESTING_DEPTH,
  cloneJson,
  evaluateSlotDiagnostics,
  extractPartsMap,
  getNodeElementType,
  getNodeId,
  normalizeStudioNode,
  toGrexJsNode,
  validateStudioNode,
} from "./schema.js";
import { buildDefaultTemplateRegistry } from "./templates.js";

function formatConditionSummary(cond) {
  if (!cond || typeof cond !== "object") {
    return "entire_site";
  }
  const op = cond.operator === "exclude" ? "EXCLUDE" : "INCLUDE";
  if (cond.type === "taxonomy_term" && cond.value && typeof cond.value === "object") {
    return `${op} taxonomy_term(${cond.value.taxonomy || "category"}=${cond.value.term || cond.value.slug || ""})`;
  }
  if (cond.value !== null && cond.value !== undefined && cond.value !== "") {
    return `${op} ${cond.type}(${String(cond.value)})`;
  }
  return `${op} ${cond.type}`;
}

function normalizeStateForDesignSystem(source) {
  const src = source && typeof source === "object" ? source : {};
  let slots = {};
  if (src.slots && typeof src.slots === "object") {
    slots = src.slots;
  } else {
    for (const [k, v] of Object.entries(src.templates || {})) {
      if (v) slots[k] = v;
    }
    for (const [pk, pv] of Object.entries(src.parts || {})) {
      if (pv) slots[`part:${pk}`] = pv;
    }
  }

  const theme = src.themeConfig || src.theme || {};
  const classes = src.classRegistry || src.classes || {};
  const templateRegistry = Array.isArray(src.templateRegistry)
    ? src.templateRegistry
    : Array.isArray(src.conditional_rules)
      ? src.conditional_rules
      : buildDefaultTemplateRegistry(slots);

  return { slots, theme, classes, templateRegistry };
}

/**
 * Deterministically generate `GRAB-DESIGN-SYSTEM.md` from active tokens, `.grex-c-*` classes,
 * `grex.elements.json` catalog rules, and conditional template slots.
 *
 * @param {object} source - Store snapshot or GrabLab `grex.elements.json` document
 * @param {{ siteName?: string, version?: string }} [options]
 * @returns {string}
 */
export function generateDesignSystemMarkdown(source, options = {}) {
  const { slots, theme, classes, templateRegistry } = normalizeStateForDesignSystem(source);
  const siteName = String(options.siteName || "Grex Theme Builder");
  const version = String(options.version || "0.4.0");

  const lines = [];
  lines.push(`# GRAB-DESIGN-SYSTEM.md`);
  lines.push(``);
  lines.push(`> Auto-generated design-system contract for **${siteName}** (\`v${version}\`, \`mode: "visual"\`, \`engine: "grex-visual"\`).`);
  lines.push(`> **AI Contract:** Inspect this document before calling \`update_entry_layout\`, \`create_entry_draft\`, or \`POST /api/mcp/layout\`.`);
  lines.push(``);

  // Section 1: Active --grex-* Design Tokens
  lines.push(`## 1. Active \`--grex-*\` Design Tokens`);
  lines.push(``);
  const baseTokens = theme.tokens || {};
  const lightTokens = theme.modes?.light || {};
  const darkTokens = theme.modes?.dark || {};

  lines.push(`### Base \`:root\` Tokens`);
  lines.push(`| Token | Value |`);
  lines.push(`|---|---|`);
  const baseKeys = Object.keys(baseTokens).sort();
  if (baseKeys.length === 0) {
    lines.push(`| \`--grex-color-primary\` | \`#047857\` |`);
  } else {
    for (const k of baseKeys) {
      lines.push(`| \`${k}\` | \`${String(baseTokens[k])}\` |`);
    }
  }
  lines.push(``);

  for (const [modeName, modeMap] of [
    ["Light Mode (`[data-grex-theme=\"light\"]`)", { ...baseTokens, ...lightTokens }],
    ["Dark Mode (`[data-grex-theme=\"dark\"]`)", { ...baseTokens, ...darkTokens }],
  ]) {
    const modeKeys = Object.keys(modeMap)
      .filter((k) => k.startsWith("--grex-color-"))
      .sort();
    lines.push(`### ${modeName}`);
    lines.push(`| Token | Value |`);
    lines.push(`|---|---|`);
    for (const k of modeKeys) {
      lines.push(`| \`${k}\` | \`${String(modeMap[k])}\` |`);
    }
    const textBgRatio = computeContrastRatio(modeMap["--grex-color-text"], modeMap["--grex-color-bg"]);
    const mutedBgRatio = computeContrastRatio(modeMap["--grex-color-text-muted"], modeMap["--grex-color-bg"]);
    if (textBgRatio !== null || mutedBgRatio !== null) {
      lines.push(``);
      lines.push(
        `- **WCAG AA Contrast Notes:** \`--grex-color-text\` on \`--grex-color-bg\` = \`${textBgRatio ?? "n/a"}:1\`; ` +
          `\`--grex-color-text-muted\` on \`--grex-color-bg\` = \`${mutedBgRatio ?? "n/a"}:1\` (minimum \`4.5:1\` normal text, \`3.0:1\` large text).`
      );
    }
    lines.push(``);
  }

  // Section 2: Reusable .grex-c-* Class Registry
  lines.push(`## 2. Reusable \`.grex-c-*\` Class Registry`);
  lines.push(``);
  lines.push(
    `Prefer attaching existing \`.grex-c-*\` classes via \`props.class\` rather than inventing one-off inline styles.`
  );
  lines.push(``);
  const classNames = Object.keys(classes || {}).sort();
  if (classNames.length === 0) {
    lines.push(`_No author-defined \`.grex-c-*\` classes registered yet._`);
  } else {
    for (const clsName of classNames) {
      const clsObj = classes[clsName] || {};
      lines.push(`- **\`.grex-c-${clsName}\`**`);
      for (const bp of ["base", "tablet", "mobile"]) {
        const bpStyles = clsObj[bp];
        if (bpStyles && typeof bpStyles === "object" && Object.keys(bpStyles).length > 0) {
          const pairs = Object.keys(bpStyles)
            .sort()
            .map((p) => `${p}: ${bpStyles[p]}`)
            .join("; ");
          lines.push(`  - \`${bp}\`: \`${pairs}\``);
        }
      }
    }
  }
  lines.push(``);

  // Section 3: Approved grex.elements.json Patterns & Semantic Rules
  lines.push(`## 3. Approved \`grex.elements.json\` Patterns & Semantic Rules`);
  lines.push(``);
  lines.push(`- **Zero Wrapper-\`<div>\` Invariant:** Never emit \`<div>\`, \`<script>\`, \`<iframe>\`, \`<object>\`, \`<style>\`, \`on*\` attributes, \`innerHTML\`, or unsafe URLs (\`javascript:\`, \`vbscript:\`, \`file:\`, \`data:\`).`);
  lines.push(`- **Maximum Nesting Depth:** \`${MAX_NESTING_DEPTH}\` levels.`);
  lines.push(`- **WCAG AA Enforcement:** Every \`Image\` requires descriptive \`alt\` text (unless explicitly \`decorative: true\`, \`alt: ""\`, \`aria-hidden: "true"\`), headings must not skip levels, interactive controls require accessible names, and text contrast must be \`>= 4.5:1\` (\`>= 3.0:1\` large text).`);
  lines.push(``);
  lines.push(`| Element | Category | Default Tag | Allowed Tags |`);
  lines.push(`|---|---|---|---|`);
  for (const elName of Object.keys(ELEMENT_CATALOG.elements)) {
    const meta = ELEMENT_CATALOG.elements[elName];
    lines.push(
      `| \`${meta.name}\` | ${meta.category} | \`<${meta.defaultTag}>\` | ${meta.allowedTags.map((t) => `\`<${t}>\``).join(", ")} |`
    );
  }
  lines.push(``);

  // Section 4: Conditional Template Slots & Reusable Parts
  lines.push(`## 4. Conditional Template Slots & Reusable Parts`);
  lines.push(``);
  const slotKeys = Object.keys(slots || {}).sort();
  lines.push(`- **Active Slots & Parts:** ${slotKeys.length > 0 ? slotKeys.map((s) => `\`${s}\``).join(", ") : "`home`, `single`, `archive`, `404`"}`);
  lines.push(``);
  lines.push(`| Template ID | Slot | Priority | Tree Slot | Conditions |`);
  lines.push(`|---|---|---|---|---|`);
  const sortedTpls = [...(templateRegistry || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const tpl of sortedTpls) {
    const condDesc = Array.isArray(tpl.conditions) && tpl.conditions.length > 0
      ? tpl.conditions.map(formatConditionSummary).join("; ")
      : "none";
    lines.push(
      `| \`${tpl.id}\` | \`${tpl.slot}\` | ${tpl.priority ?? 10} | \`${tpl.treeSlot || tpl.slot}\` | ${condDesc} |`
    );
  }
  lines.push(``);

  return lines.join("\n");
}

/**
 * Strictly validate an incoming AI layout payload (`update_entry_layout` / `create_entry_draft` / `POST /api/mcp/layout`)
 * before it can touch `createBuilderStore` or `studio_layouts`.
 *
 * Enforces:
 *   1. `validateStudioNode()` + `validateElementNode({ strictProps: true })` (no `<div>`, `<script>`, `on*`, `javascript:`, depth > 24)
 *   2. `evaluateSlotDiagnostics()` + `auditAccessibility()` WCAG AA contrast (`>= 4.5:1`), `alt` text (`GREX-A11Y-002`),
 *      form labels (`GREX-A11Y-003`), heading hierarchy (`GREX-A11Y-004`), and interactive names (`GREX-A11Y-005`).
 *
 * @param {object} payload
 * @param {{ themeConfig?: object, parts?: Record<string, object>, allowedSlots?: string[] }} [context]
 * @returns {{
 *   ok: boolean,
 *   status: number,
 *   mcpCode?: number,
 *   code?: string,
 *   error?: string,
 *   issues?: Array<object>,
 *   slot?: string,
 *   normalizedTree?: object
 * }}
 */
export function validateAiLayoutPayload(payload, context = {}) {
  const raw = payload && typeof payload === "object" && payload.arguments ? payload.arguments : payload;
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: "GREX-MCP-400",
      error: "AI layout payload must be a JSON object.",
      issues: [{ severity: "error", code: "GREX-MCP-400", message: "AI layout payload must be a JSON object." }],
    };
  }

  const slot = String(raw.slot || "home").trim();
  if (Array.isArray(context.allowedSlots) && context.allowedSlots.length > 0 && !context.allowedSlots.includes(slot)) {
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: "GREX-MCP-SLOT",
      error: `Unknown target slot "${slot}".`,
      issues: [{ severity: "error", code: "GREX-MCP-SLOT", message: `Unknown target slot "${slot}".` }],
    };
  }

  const candidateTree = raw.layout || raw.nextTree || raw.tree;
  if (!candidateTree || typeof candidateTree !== "object" || Array.isArray(candidateTree)) {
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: "GREX-SCHEMA-001",
      error: "AI layout payload must include a valid root layout node.",
      issues: [{ severity: "error", code: "GREX-SCHEMA-001", message: "Missing root layout node." }],
    };
  }

  const partsMap = context.parts || {};
  let normalizedTree;
  try {
    normalizedTree = normalizeStudioNode(cloneJson(candidateTree), slot);
    validateStudioNode(normalizedTree, partsMap);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: err instanceof GrexSecurityError ? "GREX-SEC-001" : "GREX-SCHEMA-001",
      error: message,
      issues: [{ severity: "error", code: "GREX-SCHEMA-001", message }],
    };
  }

  const defaultBg =
    context.themeConfig?.modes?.light?.["--grex-color-bg"] ||
    context.themeConfig?.tokens?.["--grex-color-bg"] ||
    "#ffffff";

  const diag = evaluateSlotDiagnostics(normalizedTree, partsMap);
  const grexTree = toGrexJsNode(normalizedTree, partsMap, 0);
  const strictA11y = auditAccessibility(grexTree, { defaultBg });

  const combinedErrors = [...diag.errors];
  for (const issue of strictA11y.issues) {
    if (issue.severity === "error") {
      const dup = combinedErrors.some(
        (e) => e.code === issue.code && e.nodeId === issue.nodeId && e.message === issue.message
      );
      if (!dup) {
        combinedErrors.push({ code: issue.code, nodeId: issue.nodeId, message: issue.message });
      }
    }
  }

  // Also check explicit node styles against active theme text/bg when only color or background-color is set
  const checkNodeThemeContrast = (node) => {
    if (!node || typeof node !== "object") return;
    const baseStyle = (node.styles && (node.styles.base || node.styles)) || {};
    const fg = baseStyle.color;
    const bg = baseStyle["background-color"] || baseStyle.backgroundColor || baseStyle.background || defaultBg;
    if (fg && bg) {
      const ratio = computeContrastRatio(fg, bg);
      if (ratio !== null && ratio < 4.5) {
        const nid = getNodeId(node) || undefined;
        if (!combinedErrors.some((e) => e.code === "GREX-A11Y-001" && e.nodeId === nid)) {
          combinedErrors.push({
            code: "GREX-A11Y-001",
            nodeId: nid,
            message: `Contrast ratio ${ratio}:1 (${fg} on ${bg}) is below WCAG AA 4.5:1.`,
          });
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const ch of node.children) {
        checkNodeThemeContrast(ch);
      }
    }
  };
  checkNodeThemeContrast(normalizedTree);

  if (combinedErrors.length > 0) {
    const first = combinedErrors[0];
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: first.code,
      error: `[${first.code}] ${first.message}`,
      issues: combinedErrors,
    };
  }

  // Ensure every node has a stable non-empty type/element for downstream consumers
  if (!getNodeElementType(normalizedTree)) {
    return {
      ok: false,
      status: 422,
      mcpCode: -32602,
      code: "GREX-SCHEMA-001",
      error: "AI layout root node missing element type.",
      issues: [{ severity: "error", code: "GREX-SCHEMA-001", message: "Missing element type." }],
    };
  }

  return {
    ok: true,
    status: 200,
    slot,
    normalizedTree,
    issues: diag.warnings,
  };
}
