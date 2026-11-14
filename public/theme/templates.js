/**
 * Grex Theme Builder v0.3 — Conditional Template Assignment, Visual Query Loop,
 * Dynamic Data Resolver (GrabDecimal/GrabInteger-safe) & Preview Context Engine.
 */

import {
  GrexSecurityError,
  formatGrabDecimal,
  isExactGrabWireString,
  isSafeUrl,
} from "./grex.js";
import { cloneJson } from "./schema.js";

export const TEMPLATE_SLOTS = Object.freeze([
  "header",
  "footer",
  "home",
  "single",
  "archive",
  "search",
  "404",
]);

export const GLOBAL_PART_SLOTS = Object.freeze([
  "header",
  "footer",
  "card",
  "hero",
  "cta",
  "sidebar",
]);

export const CONDITION_TYPES = Object.freeze([
  "entire_site",
  "front_page",
  "all_posts",
  "content_type",
  "taxonomy_term",
  "entry_slug",
  "page_404",
  "search_results",
]);

export const CONDITION_SPECIFICITY = Object.freeze({
  entry_slug: 100,
  taxonomy_term: 80,
  content_type: 60,
  all_posts: 50,
  front_page: 50,
  search_results: 50,
  page_404: 50,
  entire_site: 10,
});

export const DEFAULT_PREVIEW_CONTEXT = Object.freeze({
  mode: "front_page",
  path: "/",
  site: {
    title: "Grex Studio Site",
    tagline: "Zero-div semantic publishing on GrabLab CMS",
  },
  entry: {
    id: 101,
    content_type: "post",
    content_type_label: "Post",
    slug: "getting-started-with-grex",
    full_path: "/posts/getting-started-with-grex",
    title: "Getting Started with Grex Theme Builder",
    excerpt: "Build responsive, accessible GrabLab sites with zero wrapper divs.",
    published_at: "2026-11-14T12:00:00Z",
    author_name: "Urbanspress Editorial",
    custom_fields: {
      price: "19.95",
      featured: "true",
      reading_minutes: "5",
    },
  },
  term: {
    taxonomy: "category",
    slug: "guides",
    name: "Guides & Tutorials",
  },
  entries: [
    {
      id: 101,
      content_type: "post",
      content_type_label: "Post",
      slug: "getting-started-with-grex",
      full_path: "/posts/getting-started-with-grex",
      title: "Getting Started with Grex Theme Builder",
      excerpt: "Build responsive, accessible GrabLab sites with zero wrapper divs.",
      published_at: "2026-11-14T12:00:00Z",
      author_name: "Urbanspress Editorial",
      terms: [{ taxonomy: "category", slug: "guides", name: "Guides & Tutorials" }],
      custom_fields: { price: "19.95", featured: "true", reading_minutes: "5" },
    },
    {
      id: 102,
      content_type: "post",
      content_type_label: "Post",
      slug: "responsive-tokens-and-classes",
      full_path: "/posts/responsive-tokens-and-classes",
      title: "Responsive Tokens & Reusable Classes",
      excerpt: "Master Bricks-style .grex-c-* utilities across Desktop, Tablet, and Mobile.",
      published_at: "2026-11-13T09:30:00Z",
      author_name: "Design Systems Team",
      terms: [{ taxonomy: "category", slug: "news", name: "News" }],
      custom_fields: { price: "49.00", featured: "true", reading_minutes: "8" },
    },
    {
      id: 103,
      content_type: "product",
      content_type_label: "Product",
      slug: "grex-pro-starter-kit",
      full_path: "/products/grex-pro-starter-kit",
      title: "Grex Pro Starter Kit",
      excerpt: "Pre-audited accessible layouts for GrabLab CMS v1.0.0.",
      published_at: "2026-11-12T15:00:00Z",
      author_name: "Urbanspress Store",
      terms: [{ taxonomy: "category", slug: "guides", name: "Guides & Tutorials" }],
      custom_fields: { price: "1000.00", featured: "false", sku: "GRX-001" },
    },
  ],
  menus: {
    primary: [
      { label: "Home", href: "/" },
      { label: "Guides", href: "/category/guides" },
      { label: "Products", href: "/products" },
      { label: "Search", href: "/search" },
    ],
    footer: [
      { label: "Privacy", href: "/privacy" },
      { label: "Accessibility", href: "/accessibility" },
    ],
    mobile: [
      { label: "Home", href: "/" },
      { label: "Guides", href: "/category/guides" },
      { label: "Search", href: "/search" },
    ],
  },
});

const DEFAULT_SLOT_CONDITION_MAP = Object.freeze({
  home: [{ type: "front_page", value: null, operator: "include" }],
  single: [{ type: "all_posts", value: null, operator: "include" }],
  archive: [{ type: "entire_site", value: null, operator: "include" }],
  search: [{ type: "search_results", value: null, operator: "include" }],
  "404": [{ type: "page_404", value: null, operator: "include" }],
  "part:header": [{ type: "entire_site", value: null, operator: "include" }],
  "part:footer": [{ type: "entire_site", value: null, operator: "include" }],
});

/**
 * Normalize and validate an array of display conditions for a template.
 * @param {Array<object>} conditions
 * @returns {Array<{ type: string, value: unknown, operator: "include" | "exclude" }>}
 */
export function normalizeTemplateConditions(conditions) {
  if (!Array.isArray(conditions)) {
    return [];
  }
  return conditions.map((cond) => {
    if (!cond || typeof cond !== "object") {
      throw new GrexSecurityError("Template condition must be an object.");
    }
    const type = String(cond.type || "").trim();
    if (!CONDITION_TYPES.includes(type)) {
      throw new GrexSecurityError(`Unsupported template condition type "${type}".`);
    }
    const operator = cond.operator === "exclude" ? "exclude" : "include";
    let value = cond.value ?? null;
    if (type === "content_type" || type === "entry_slug") {
      value = String(value || "").trim();
      if (!value) {
        throw new GrexSecurityError(`Template condition "${type}" requires a non-empty string value.`);
      }
    } else if (type === "taxonomy_term") {
      if (!value || typeof value !== "object") {
        throw new GrexSecurityError('Template condition "taxonomy_term" requires { taxonomy, term }.');
      }
      const taxonomy = String(value.taxonomy || "category").trim();
      const term = String(value.term || value.slug || "").trim();
      if (!taxonomy || !term) {
        throw new GrexSecurityError('Template condition "taxonomy_term" requires non-empty taxonomy and term.');
      }
      value = { taxonomy, term };
    } else {
      value = null;
    }
    return { type, value, operator };
  });
}

/**
 * Build or normalize the multi-template registry from `slots` and optional persisted `rawRegistry`.
 * @param {Record<string, object>} slots
 * @param {Array<object> | Record<string, object>} [rawRegistry]
 * @returns {Array<{ id: string, name: string, slot: string, priority: number, conditions: Array<object>, treeSlot: string }>}
 */
export function buildDefaultTemplateRegistry(slots, rawRegistry = null) {
  if (Array.isArray(rawRegistry) && rawRegistry.length > 0) {
    return rawRegistry.map((tpl, idx) => ({
      id: String(tpl.id || `tpl_${tpl.slot || "home"}_${idx}`).trim(),
      name: String(tpl.name || tpl.id || `Template ${idx + 1}`),
      slot: String(tpl.slot || "home"),
      priority: Number.isInteger(Number(tpl.priority)) ? Number(tpl.priority) : 10,
      conditions: normalizeTemplateConditions(tpl.conditions || []),
      treeSlot: String(tpl.treeSlot || (tpl.slot === "header" || tpl.slot === "footer" ? `part:${tpl.slot}` : tpl.slot || "home")),
      ...(tpl.tree ? { tree: cloneJson(tpl.tree) } : {}),
    }));
  }

  const list = [];
  for (const slotKey of Object.keys(slots || {})) {
    const isPartHeaderFooter = slotKey === "part:header" || slotKey === "part:footer";
    const isTemplateSlot = !slotKey.startsWith("part:");
    if (!isTemplateSlot && !isPartHeaderFooter) {
      continue;
    }
    const cleanSlot = isPartHeaderFooter ? slotKey.slice(5) : slotKey;
    list.push({
      id: `tpl_${cleanSlot}_default`,
      name: `Default ${cleanSlot.toUpperCase()} Template`,
      slot: cleanSlot,
      priority: 10,
      conditions: cloneJson(DEFAULT_SLOT_CONDITION_MAP[slotKey] || [{ type: "entire_site", value: null, operator: "include" }]),
      treeSlot: slotKey,
    });
  }
  return list;
}

/**
 * Evaluate whether a single display condition matches a request/preview context.
 * @param {{ type: string, value: unknown }} condition
 * @param {object} context
 * @returns {boolean}
 */
export function evaluateTemplateCondition(condition, context = {}) {
  const mode = String(context.mode || context.routeType || "front_page").toLowerCase();
  const contentType = String(context.content_type || context.contentType || context.entry?.content_type || "").trim();
  const slug = String(context.slug || context.path || context.entry?.full_path || context.entry?.slug || "").trim();
  const tax = String(context.taxonomy || context.term?.taxonomy || "").trim();
  const termSlug = String(context.termSlug || context.term?.slug || "").trim();

  switch (condition.type) {
    case "entire_site":
      return true;
    case "front_page":
      return mode === "front_page" || mode === "home" || context.path === "/";
    case "all_posts":
      return (mode === "single" || mode === "entry") && (contentType === "" || contentType === "post");
    case "content_type":
      return contentType !== "" && contentType === String(condition.value || "");
    case "taxonomy_term": {
      const targetTax = String(condition.value?.taxonomy || "");
      const targetTerm = String(condition.value?.term || "");
      if (tax && termSlug) {
        return tax === targetTax && termSlug === targetTerm;
      }
      const entryTerms = Array.isArray(context.entry?.terms) ? context.entry.terms : [];
      return entryTerms.some((t) => t.taxonomy === targetTax && t.slug === targetTerm);
    }
    case "entry_slug": {
      const target = String(condition.value || "").replace(/^\/+/, "");
      const candFull = String(context.entry?.full_path || "").replace(/^\/+/, "");
      const candSlug = String(context.entry?.slug || "").replace(/^\/+/, "");
      const candPath = slug.replace(/^\/+/, "");
      return target !== "" && (candFull === target || candSlug === target || candPath === target);
    }
    case "page_404":
      return mode === "404" || mode === "page_404";
    case "search_results":
      return mode === "search" || mode === "search_results";
    default:
      return false;
  }
}

/**
 * Resolve the winning template for `slot` under `context`.
 * Specificity: entry_slug (100) > taxonomy_term (80) > content_type (60) >
 * all_posts/front_page/search_results/page_404 (50) > entire_site (10),
 * then highest explicit priority, then lexicographical `id`.
 *
 * @param {Array<object>} templates
 * @param {string} slot
 * @param {object} context
 * @returns {object | null}
 */
export function resolveTemplateForContext(templates, slot, context = {}) {
  const candidates = (templates || []).filter((t) => t && t.slot === slot);
  const matched = [];

  for (const tpl of candidates) {
    const conds = Array.isArray(tpl.conditions) ? tpl.conditions : [];
    const excluded = conds.some((c) => c.operator === "exclude" && evaluateTemplateCondition(c, context));
    if (excluded) {
      continue;
    }
    let bestSpec = -1;
    for (const c of conds) {
      if (c.operator !== "exclude" && evaluateTemplateCondition(c, context)) {
        const spec = CONDITION_SPECIFICITY[c.type] ?? 0;
        if (spec > bestSpec) {
          bestSpec = spec;
        }
      }
    }
    if (bestSpec >= 0) {
      matched.push({ tpl, specificity: bestSpec, priority: Number(tpl.priority ?? 0) });
    }
  }

  if (matched.length === 0) {
    return null;
  }

  matched.sort((a, b) => {
    if (b.specificity !== a.specificity) {
      return b.specificity - a.specificity;
    }
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return String(a.tpl.id).localeCompare(String(b.tpl.id));
  });

  return matched[0].tpl;
}

function canonicalConditionSignature(conditions) {
  return JSON.stringify(
    (conditions || [])
      .map((c) => ({
        type: c.type,
        operator: c.operator || "include",
        value: c.value ?? null,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  );
}

/**
 * Detect colliding templates in the same slot with identical conditions and equal priority.
 * Emits `GREX-TPL-CONFLICT` warnings that block Publish until resolved.
 *
 * @param {Array<object>} templates
 * @returns {Array<{ code: "GREX-TPL-CONFLICT", severity: "error", slot: string, templateIds: [string, string], message: string }>}
 */
export function detectTemplateConflicts(templates) {
  const conflicts = [];
  const seen = new Map();

  for (const tpl of templates || []) {
    if (!tpl || !Array.isArray(tpl.conditions) || tpl.conditions.length === 0) {
      continue;
    }
    const key = `${tpl.slot}::${Number(tpl.priority ?? 0)}::${canonicalConditionSignature(tpl.conditions)}`;
    if (seen.has(key)) {
      const other = seen.get(key);
      conflicts.push({
        code: "GREX-TPL-CONFLICT",
        severity: "error",
        slot: tpl.slot,
        templateIds: [other.id, tpl.id],
        message: `Template conflict in slot "${tpl.slot}": "${other.name}" (${other.id}) and "${tpl.name}" (${tpl.id}) share identical conditions and priority ${tpl.priority}.`,
      });
    } else {
      seen.set(key, tpl);
    }
  }

  return conflicts;
}

/**
 * Normalize a visual Query Loop configuration matching GrabLab `query_entries` parameters.
 * Clamps `per_page` to 1..50 and `page` >= 1.
 *
 * @param {object} raw
 * @returns {object}
 */
export function normalizeQueryLoopConfig(raw = {}) {
  const perPageNum = Number(raw.per_page ?? 12);
  const perPage = Number.isFinite(perPageNum) ? Math.max(1, Math.min(50, Math.trunc(perPageNum))) : 12;
  const pageNum = Number(raw.page ?? 1);
  const page = Number.isFinite(pageNum) ? Math.max(1, Math.trunc(pageNum)) : 1;

  const allowedOrderBy = new Set(["published_at", "created_at", "updated_at", "title", "id"]);
  const orderBy = allowedOrderBy.has(String(raw.order_by || raw.sort_by || "published_at"))
    ? String(raw.order_by || raw.sort_by || "published_at")
    : "published_at";
  const orderDir = String(raw.order_dir || raw.sort_dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  let filterByTerm = null;
  if (raw.filter_by_term && typeof raw.filter_by_term === "object") {
    const tax = String(raw.filter_by_term.taxonomy || "").trim();
    const slug = String(raw.filter_by_term.slug || raw.filter_by_term.term || "").trim();
    if (tax && slug) {
      filterByTerm = { taxonomy: tax, slug };
    }
  }

  const customFieldFilters = [];
  if (Array.isArray(raw.custom_field_filters)) {
    for (const f of raw.custom_field_filters) {
      if (f && typeof f === "object" && typeof f.key === "string" && f.key.trim()) {
        customFieldFilters.push({
          key: f.key.trim(),
          op: ["eq", "neq", "contains"].includes(String(f.op || "eq")) ? String(f.op || "eq") : "eq",
          value: String(f.value ?? ""),
        });
      }
    }
  }

  return {
    enabled: Boolean(raw.enabled),
    content_type: String(raw.content_type || "").trim(),
    filter_by_term: filterByTerm,
    custom_field_filters: customFieldFilters,
    order_by: orderBy,
    order_dir: orderDir,
    per_page: perPage,
    page,
    empty_text: typeof raw.empty_text === "string" && raw.empty_text.trim()
      ? raw.empty_text.trim()
      : "No matching entries found.",
  };
}

/**
 * Filter, sort, and paginate entries in memory using GrabLab `query_entries` semantics.
 * @param {Array<object>} entries
 * @param {object} rawQuery
 * @returns {{ items: Array<object>, pagination: { page: number, per_page: number, total_items: number, total_pages: number, has_prev: boolean, has_next: boolean } }}
 */
export function filterPreviewEntries(entries, rawQuery = {}) {
  const q = normalizeQueryLoopConfig(rawQuery);
  let list = Array.isArray(entries) ? entries.slice() : [];

  if (q.content_type) {
    list = list.filter((e) => String(e.content_type || "") === q.content_type);
  }
  if (q.filter_by_term) {
    const { taxonomy, slug } = q.filter_by_term;
    list = list.filter(
      (e) => Array.isArray(e.terms) && e.terms.some((t) => t.taxonomy === taxonomy && t.slug === slug)
    );
  }
  for (const cf of q.custom_field_filters) {
    list = list.filter((e) => {
      const actual = String(e.custom_fields?.[cf.key] ?? "");
      if (cf.op === "neq") {
        return actual !== cf.value;
      }
      if (cf.op === "contains") {
        return actual.toLowerCase().includes(cf.value.toLowerCase());
      }
      return actual === cf.value;
    });
  }

  list.sort((a, b) => {
    const av = String(a[q.order_by] ?? "");
    const bv = String(b[q.order_by] ?? "");
    const cmp = av.localeCompare(bv);
    return q.order_dir === "asc" ? cmp : -cmp;
  });

  const totalItems = list.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / q.per_page);
  const start = (q.page - 1) * q.per_page;
  const items = list.slice(start, start + q.per_page);

  return {
    items,
    pagination: {
      page: q.page,
      per_page: q.per_page,
      total_items: totalItems,
      total_pages: totalPages,
      has_prev: q.page > 1 && totalPages > 0,
      has_next: q.page < totalPages,
    },
  };
}

function formatWireSafeValue(val) {
  if (val === null || val === undefined) {
    return "";
  }
  if (typeof val === "string") {
    // Preserve exact GrabDecimal / GrabInteger base-10 wire strings without IEEE-754 float coercion
    if (isExactGrabWireString(val)) {
      return formatGrabDecimal(val);
    }
    return val;
  }
  if (typeof val === "number") {
    return Number.isInteger(val) ? String(val) : formatGrabDecimal(String(val));
  }
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  return String(val);
}

function lookupContextToken(tokenPath, ctx) {
  const clean = String(tokenPath || "").trim();
  const entry = ctx.entry || {};
  const term = ctx.term || {};
  const site = ctx.site || {};

  if (clean.startsWith("entry.custom_fields.")) {
    const fieldKey = clean.slice("entry.custom_fields.".length);
    return formatWireSafeValue(entry.custom_fields?.[fieldKey]);
  }
  if (clean.startsWith("entry.")) {
    const prop = clean.slice("entry.".length);
    if (prop === "slug" && !entry.slug && entry.full_path) {
      return formatWireSafeValue(entry.full_path);
    }
    return formatWireSafeValue(entry[prop]);
  }
  if (clean.startsWith("term.")) {
    const prop = clean.slice("term.".length);
    return formatWireSafeValue(term[prop]);
  }
  if (clean.startsWith("site.")) {
    const prop = clean.slice("site.".length);
    return formatWireSafeValue(site[prop]);
  }

  // Legacy single-brace GrabLab tokens
  switch (clean) {
    case "title":
    case "page_title":
      return formatWireSafeValue(entry.title || site.title);
    case "full_path":
      return formatWireSafeValue(entry.full_path || (entry.slug ? `/${entry.slug}` : "/"));
    case "excerpt":
      return formatWireSafeValue(entry.excerpt);
    case "published_at":
      return formatWireSafeValue(entry.published_at);
    case "content_type_label":
      return formatWireSafeValue(entry.content_type_label || entry.content_type);
    case "site_title":
      return formatWireSafeValue(site.title);
    case "site_tagline":
      return formatWireSafeValue(site.tagline);
    case "theme_name":
      return "Grex Theme Builder";
    case "theme_slug":
      return "grex-builder";
    case "published_count":
      return String(Array.isArray(ctx.entries) ? ctx.entries.length : 0);
    default:
      return formatWireSafeValue(ctx[clean]);
  }
}

/**
 * Resolve `{{ entry.* }}`, `{{ term.* }}`, `{{ site.* }}` and `{token}` expressions
 * with exact GrabDecimal/GrabInteger base-10 string preservation.
 *
 * @param {string} rawText
 * @param {object} [context]
 * @returns {string}
 */
export function resolveDynamicExpression(rawText, context = {}) {
  if (typeof rawText !== "string") {
    return rawText == null ? "" : formatWireSafeValue(rawText);
  }
  const ctx = context || {};
  let out = rawText.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) =>
    lookupContextToken(key, ctx)
  );
  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const resolved = lookupContextToken(key, ctx);
    return resolved !== "" ? resolved : match;
  });
  return out;
}

/**
 * Validate and resolve dynamic prop expressions on a node for live preview rendering.
 * Rejects any resolved unsafe URL (`javascript:`, `vbscript:`, `data:`).
 *
 * @param {object} props
 * @param {object} context
 * @returns {object}
 */
export function resolveDynamicProps(props, context = {}) {
  const out = { ...(props || {}) };
  for (const key of ["text", "label", "title", "alt", "href", "src"]) {
    if (typeof out[key] === "string") {
      const resolved = resolveDynamicExpression(out[key], context);
      if ((key === "href" || key === "src") && !isSafeUrl(resolved)) {
        throw new GrexSecurityError(`Unsafe resolved dynamic URL in "${key}": "${resolved}".`);
      }
      out[key] = resolved;
    }
  }
  return out;
}
