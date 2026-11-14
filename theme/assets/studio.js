/**
 * Grex Theme Builder — Split-Screen Studio UI (v0.3).
 * 100% Grex JS v1.0.0 runtime: zero Vue, Pinia, React, Webpack, or Vite,
 * and zero wrapper <div> elements across all studio panels.
 */

import {
  effect,
  renderElement,
  setSafeText,
  Section,
  Stack,
  Heading,
  Text,
  Button,
} from "./grex.js";
import {
  ELEMENT_CATALOG,
  SUPPORTED_STYLE_PROPS,
  getNodeElementType,
  getNodeGrexClasses,
  getNodeId,
  getNodeTag,
} from "./schema.js";
import {
  CONDITION_TYPES,
  DEFAULT_PREVIEW_CONTEXT,
  TEMPLATE_SLOTS,
  GLOBAL_PART_SLOTS,
} from "./templates.js";
import { findNodeLocation } from "./commands.js";
import { createStudioPreviewClient } from "./preview-bridge.js";

const THEME_TOKEN_GROUPS = [
  {
    title: "Brand & Surface Colors",
    tokens: [
      "--grex-color-primary",
      "--grex-color-secondary",
      "--grex-color-accent",
      "--grex-color-bg",
      "--grex-color-surface",
      "--grex-color-text",
      "--grex-color-text-muted",
      "--grex-color-border",
    ],
  },
  {
    title: "Typography Scale",
    tokens: [
      "--grex-font-sans",
      "--grex-font-heading",
      "--grex-font-mono",
      "--grex-text-base",
      "--grex-text-sm",
      "--grex-text-lg",
      "--grex-text-xl",
      "--grex-text-2xl",
      "--grex-leading-normal",
      "--grex-leading-tight",
    ],
  },
  {
    title: "Spacing Scale",
    tokens: [
      "--grex-space-1",
      "--grex-space-2",
      "--grex-space-3",
      "--grex-space-4",
      "--grex-space-5",
      "--grex-space-6",
      "--grex-space-7",
      "--grex-space-8",
    ],
  },
  {
    title: "Radii, Shadows & Focus Ring",
    tokens: [
      "--grex-radius-sm",
      "--grex-radius-md",
      "--grex-radius-lg",
      "--grex-shadow-sm",
      "--grex-shadow-md",
      "--grex-focus-ring",
    ],
  },
];

const INSPECTOR_STYLE_GROUPS = [
  {
    title: "Box Model",
    props: [
      ["padding", "Padding"],
      ["padding-block", "Padding Block"],
      ["padding-inline", "Padding Inline"],
      ["margin", "Margin"],
      ["margin-block", "Margin Block"],
      ["margin-inline", "Margin Inline"],
    ],
  },
  {
    title: "Layout (Flex / Grid)",
    props: [
      ["display", "Display"],
      ["flex-direction", "Flex Direction"],
      ["justify-content", "Justify Content"],
      ["align-items", "Align Items"],
      ["gap", "Gap"],
      ["grid-template-columns", "Grid Columns"],
      ["grid-template-rows", "Grid Rows"],
    ],
  },
  {
    title: "Typography",
    props: [
      ["font-family", "Font Family"],
      ["font-size", "Font Size"],
      ["font-weight", "Font Weight"],
      ["line-height", "Line Height"],
      ["text-align", "Text Align"],
      ["color", "Text Color"],
    ],
  },
  {
    title: "Border & Background",
    props: [
      ["background", "Background"],
      ["background-color", "Background Color"],
      ["border", "Border"],
      ["border-radius", "Border Radius"],
      ["box-shadow", "Box Shadow"],
    ],
  },
];

const BREAKPOINT_META = {
  base: { label: "Desktop", badge: ">= 1025px", width: "100%" },
  tablet: { label: "Tablet", badge: "<= 1024px", width: "768px" },
  mobile: { label: "Mobile", badge: "<= 767px", width: "375px" },
};

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function getTargetParentForInsert(store) {
  const root = store.activeSlotTree.peek();
  const sel = store.selectedNode.peek();
  if (sel) {
    const selType = getNodeElementType(sel);
    const meta = ELEMENT_CATALOG.elements[selType];
    if (selType === "Fragment" || (meta && meta.acceptsChildren)) {
      return getNodeId(sel);
    }
    const loc = root ? findNodeLocation(root, getNodeId(sel)) : null;
    if (loc && loc.parent) {
      return getNodeId(loc.parent);
    }
  }
  return getNodeId(root);
}

/**
 * Create a HTTP JSON transport backed by GrabLab / GRAB Studio API routes with CSRF token.
 * @param {{ csrfToken?: string, baseUrl?: string }} [opts]
 */
export function createStudioHttpTransport(opts = {}) {
  const csrfToken =
    opts.csrfToken ||
    (typeof document !== "undefined"
      ? document.querySelector('meta[name="grex-csrf"]')?.getAttribute("content") || ""
      : "");
  const baseUrl = opts.baseUrl || "";

  async function postJson(path, body) {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: data.error || `HTTP ${resp.status}`, data };
    }
    return { ok: true, status: resp.status, data };
  }

  async function getJson(path) {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: data.error || `HTTP ${resp.status}`, data };
    }
    return { ok: true, status: resp.status, data };
  }

  return {
    saveDraft(payload) {
      return postJson("/api/studio/draft", payload);
    },
    publish(payload) {
      return postJson("/api/studio/publish", payload);
    },
    listMedia() {
      return getJson("/api/media");
    },
    getMenu(location) {
      return getJson(`/api/menus/${encodeURIComponent(location || "primary")}`);
    },
    queryEntries(params = {}) {
      const qs = new URLSearchParams();
      if (params.content_type) qs.set("content_type", params.content_type);
      if (params.term) qs.set("term", params.term);
      if (params.page) qs.set("page", String(params.page));
      if (params.per_page) qs.set("per_page", String(params.per_page));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return getJson(`/api/query${suffix}`);
    },
    getPreviewContext() {
      return getJson("/api/preview/context");
    },
  };
}

/**
 * Mount the full split-screen Grex Theme Builder studio inside `root`.
 *
 * @param {{
 *   root: Element,
 *   document?: Document,
 *   store: ReturnType<import("./store.js").createBuilderStore>,
 *   transport?: { saveDraft: Function, publish: Function },
 *   previewOrigin?: string,
 *   previewSrc?: string
 * }} options
 */
export function mountBuilderStudio(options) {
  if (!options || !options.root || !options.store) {
    throw new TypeError("mountBuilderStudio({ root, store }) requires root and store.");
  }

  const doc = options.document || options.root.ownerDocument || globalThis.document;
  const root = options.root;
  const store = options.store;
  const transport = options.transport || createStudioHttpTransport();
  const previewOrigin =
    options.previewOrigin ||
    (typeof window !== "undefined" && window.location ? window.location.origin : "http://127.0.0.1");

  clearChildren(root);

  const disposers = [];
  let draggedElementType = null;

  // --- Top Studio Header ---
  const slotSelectEl = doc.createElement("select");
  slotSelectEl.id = "grex-slot-select";
  slotSelectEl.setAttribute("aria-label", "Active Template Slot");
  for (const sName of store.slotNames()) {
    const opt = doc.createElement("option");
    opt.value = sName;
    opt.textContent = sName;
    slotSelectEl.appendChild(opt);
  }
  slotSelectEl.addEventListener("change", (e) => {
    store.selectSlot(e.target.value);
  });

  const undoBtn = Button(
    {
      id: "studio-undo-btn",
      props: { text: "Undo", type: "button" },
      on: { click: () => store.undo() },
    },
    { document: doc }
  );
  const redoBtn = Button(
    {
      id: "studio-redo-btn",
      props: { text: "Redo", type: "button" },
      on: { click: () => store.redo() },
    },
    { document: doc }
  );
  const saveDraftBtn = Button(
    {
      id: "studio-save-draft-btn",
      props: { text: "Save Draft", type: "button" },
      on: {
        click: () => {
          void store.saveDraft(transport);
        },
      },
    },
    { document: doc }
  );
  const publishBtn = Button(
    {
      id: "studio-publish-btn",
      props: { text: "Publish", type: "button" },
      on: {
        click: () => {
          void store.publish(transport);
        },
      },
    },
    { document: doc }
  );

  const statusBadge = renderElement(
    { tag: "span", attrs: { class: "grex-studio-status", role: "status", "aria-live": "polite" } },
    { document: doc }
  );
  const a11yBadge = renderElement(
    { tag: "span", attrs: { class: "grex-studio-a11y-badge" } },
    { document: doc }
  );

  const brandGroup = Stack(
    {
      id: "studio-brand-group",
      tag: "section",
      className: "grex-studio-brand",
      props: { direction: "row" },
      children: [Heading({ props: { level: 1, text: "Grex Theme Builder" } }, { document: doc })],
    },
    { document: doc }
  );
  brandGroup.element.appendChild(slotSelectEl);
  brandGroup.element.appendChild(statusBadge.element);
  brandGroup.element.appendChild(a11yBadge.element);

  const actionsGroup = Stack(
    {
      id: "studio-actions-group",
      tag: "section",
      className: "grex-studio-actions",
      props: { direction: "row" },
      children: [],
    },
    { document: doc }
  );

  const bpNav = doc.createElement("nav");
  bpNav.id = "grex-breakpoint-nav";
  bpNav.className = "grex-breakpoint-nav";
  bpNav.setAttribute("aria-label", "Responsive Breakpoints");
  const bpButtons = {};
  for (const [bpKey, bpInfo] of Object.entries(BREAKPOINT_META)) {
    const bpBtn = doc.createElement("button");
    bpBtn.type = "button";
    bpBtn.className = "grex-bp-btn";
    bpBtn.setAttribute("data-breakpoint", bpKey);
    bpBtn.setAttribute("aria-label", `${bpInfo.label} (${bpInfo.badge})`);
    setSafeText(bpBtn, `${bpInfo.label} ${bpInfo.badge}`);
    bpBtn.addEventListener("click", () => {
      store.setBreakpoint(bpKey);
    });
    bpButtons[bpKey] = bpBtn;
    bpNav.appendChild(bpBtn);
  }

  const themeModeBtn = doc.createElement("button");
  themeModeBtn.type = "button";
  themeModeBtn.id = "studio-theme-mode-btn";
  themeModeBtn.className = "grex-theme-mode-btn";
  themeModeBtn.addEventListener("click", () => {
    const next = store.activeThemeMode.peek() === "dark" ? "light" : "dark";
    store.setThemeMode(next);
  });

  const previewCtxBar = doc.createElement("section");
  previewCtxBar.id = "grex-preview-context-bar";
  previewCtxBar.className = "grex-preview-context-bar";
  previewCtxBar.setAttribute("aria-label", "Live Preview Context Selector");

  const previewModeSelect = doc.createElement("select");
  previewModeSelect.id = "grex-preview-mode-select";
  previewModeSelect.setAttribute("aria-label", "Preview As Context");
  for (const [mVal, mLabel] of [
    ["front_page", "Preview As: Front Page"],
    ["single", "Preview As: Specific Entry"],
    ["archive", "Preview As: Specific Term Archive"],
    ["search", "Preview As: Search Results"],
    ["404", "Preview As: 404 Page"],
  ]) {
    const opt = doc.createElement("option");
    opt.value = mVal;
    opt.textContent = mLabel;
    previewModeSelect.appendChild(opt);
  }

  const previewEntrySelect = doc.createElement("select");
  previewEntrySelect.id = "grex-preview-entry-select";
  previewEntrySelect.setAttribute("aria-label", "Preview Target Entry");

  const previewTermSelect = doc.createElement("select");
  previewTermSelect.id = "grex-preview-term-select";
  previewTermSelect.setAttribute("aria-label", "Preview Target Term");
  for (const [tSlug, tName] of [
    ["guides", "Category: Guides & Tutorials"],
    ["news", "Category: News"],
    ["design", "Category: Design"],
    ["docs", "Topic: Docs"],
  ]) {
    const opt = doc.createElement("option");
    opt.value = tSlug;
    opt.textContent = tName;
    previewTermSelect.appendChild(opt);
  }

  previewModeSelect.addEventListener("change", (ev) => {
    const mode = ev.target.value;
    const ctxNow = store.previewContext.peek() || DEFAULT_PREVIEW_CONTEXT;
    const entries = Array.isArray(ctxNow.entries) ? ctxNow.entries : DEFAULT_PREVIEW_CONTEXT.entries;
    const chosenEntry = entries.find((e) => e.slug === previewEntrySelect.value) || ctxNow.entry || entries[0];
    const pathMap = {
      front_page: "/",
      single: chosenEntry ? chosenEntry.full_path || `/posts/${chosenEntry.slug}` : "/posts/sample",
      archive: `/category/${previewTermSelect.value || "guides"}`,
      search: "/search?q=grex",
      404: "/not-found-preview",
    };
    store.setPreviewContext({
      mode,
      path: pathMap[mode] || "/",
      entry: chosenEntry || ctxNow.entry,
    });
  });

  previewEntrySelect.addEventListener("change", (ev) => {
    const slug = ev.target.value;
    const ctxNow = store.previewContext.peek() || DEFAULT_PREVIEW_CONTEXT;
    const entries = Array.isArray(ctxNow.entries) ? ctxNow.entries : DEFAULT_PREVIEW_CONTEXT.entries;
    const matched = entries.find((e) => e.slug === slug);
    if (matched) {
      store.setPreviewContext({
        mode: "single",
        path: matched.full_path || `/posts/${matched.slug}`,
        entry: matched,
      });
    }
  });

  previewTermSelect.addEventListener("change", (ev) => {
    const slug = ev.target.value;
    const selectedOpt = ev.target.selectedOptions?.[0];
    const name = selectedOpt ? selectedOpt.textContent.replace(/^[^:]+:\s*/, "") : slug;
    store.setPreviewContext({
      mode: "archive",
      path: `/category/${slug}`,
      term: { taxonomy: "category", slug, name },
    });
  });

  previewCtxBar.appendChild(previewModeSelect);
  previewCtxBar.appendChild(previewEntrySelect);
  previewCtxBar.appendChild(previewTermSelect);

  actionsGroup.element.appendChild(previewCtxBar);
  actionsGroup.element.appendChild(bpNav);
  actionsGroup.element.appendChild(themeModeBtn);
  actionsGroup.element.appendChild(undoBtn.element);
  actionsGroup.element.appendChild(redoBtn.element);
  actionsGroup.element.appendChild(saveDraftBtn.element);
  actionsGroup.element.appendChild(publishBtn.element);

  const topbar = Section(
    {
      id: "grex-studio-topbar",
      tag: "header",
      className: "grex-studio-topbar",
      props: { label: "Grex Theme Builder Toolbar" },
      children: [brandGroup, actionsGroup],
    },
    { document: doc }
  );

  // --- Left Sidebar: 20-Element Palette + Semantic Structure Tree ---
  const paletteContainer = Section(
    {
      id: "grex-element-palette",
      tag: "section",
      className: "grex-palette-panel",
      props: { label: "20-Element Palette" },
      children: [
        Heading({ props: { level: 2, text: "Elements (20)" } }, { document: doc }),
      ],
    },
    { document: doc }
  );

  const categories = new Map();
  for (const [elName, meta] of Object.entries(ELEMENT_CATALOG.elements)) {
    if (!categories.has(meta.category)) {
      categories.set(meta.category, []);
    }
    categories.get(meta.category).push(meta);
  }

  for (const [catName, items] of categories.entries()) {
    const catHeading = Heading(
      { props: { level: 3, text: catName.toUpperCase() } },
      { document: doc }
    );
    const listEl = doc.createElement("ul");
    listEl.className = "grex-palette-grid";
    listEl.setAttribute("aria-label", `${catName} elements`);

    for (const meta of items) {
      const li = doc.createElement("li");
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "grex-palette-item";
      btn.setAttribute("data-element-type", meta.name);
      btn.setAttribute("draggable", "true");
      btn.setAttribute("aria-label", `Insert ${meta.name} (${meta.defaultTag})`);
      setSafeText(btn, `${meta.name} <${meta.defaultTag}>`);

      btn.addEventListener("click", () => {
        const targetParentId = getTargetParentForInsert(store);
        store.insertElement(meta.name, targetParentId);
      });

      btn.addEventListener("dragstart", (ev) => {
        draggedElementType = meta.name;
        if (ev.dataTransfer && typeof ev.dataTransfer.setData === "function") {
          ev.dataTransfer.setData("text/plain", meta.name);
        }
      });

      li.appendChild(btn);
      listEl.appendChild(li);
    }

    paletteContainer.element.appendChild(catHeading.element);
    paletteContainer.element.appendChild(listEl);
  }

  const structureNav = doc.createElement("nav");
  structureNav.id = "grex-structure-tree";
  structureNav.className = "grex-structure-panel";
  structureNav.setAttribute("aria-label", "Structure Tree");

  const themeTokensSection = doc.createElement("section");
  themeTokensSection.id = "grex-theme-tokens-panel";
  themeTokensSection.className = "grex-theme-tokens-panel";
  themeTokensSection.setAttribute("aria-label", "Global Theme Tokens");

  const templatesSection = doc.createElement("section");
  templatesSection.id = "grex-templates-panel";
  templatesSection.className = "grex-templates-panel";
  templatesSection.setAttribute("aria-label", "Conditional Templates");

  let activeTokenEditMode = "light";

  const leftTabsNav = doc.createElement("nav");
  leftTabsNav.className = "grex-left-tabs";
  leftTabsNav.setAttribute("aria-label", "Studio Left Panels");
  const tabElementsBtn = doc.createElement("button");
  tabElementsBtn.type = "button";
  tabElementsBtn.id = "grex-tab-elements";
  tabElementsBtn.className = "grex-tab-btn is-active";
  setSafeText(tabElementsBtn, "Elements & Tree");
  const tabTokensBtn = doc.createElement("button");
  tabTokensBtn.type = "button";
  tabTokensBtn.id = "grex-tab-tokens";
  tabTokensBtn.className = "grex-tab-btn";
  setSafeText(tabTokensBtn, "Theme Tokens");
  const tabTemplatesBtn = doc.createElement("button");
  tabTemplatesBtn.type = "button";
  tabTemplatesBtn.id = "grex-tab-templates";
  tabTemplatesBtn.className = "grex-tab-btn";
  setSafeText(tabTemplatesBtn, "Templates");

  const showLeftTab = (which) => {
    const isElements = which === "elements";
    const isTokens = which === "tokens";
    const isTemplates = which === "templates";
    paletteContainer.element.hidden = !isElements;
    structureNav.hidden = !isElements;
    themeTokensSection.hidden = !isTokens;
    templatesSection.hidden = !isTemplates;
    tabElementsBtn.className = isElements ? "grex-tab-btn is-active" : "grex-tab-btn";
    tabTokensBtn.className = isTokens ? "grex-tab-btn is-active" : "grex-tab-btn";
    tabTemplatesBtn.className = isTemplates ? "grex-tab-btn is-active" : "grex-tab-btn";
  };
  themeTokensSection.hidden = true;
  templatesSection.hidden = true;
  tabElementsBtn.addEventListener("click", () => showLeftTab("elements"));
  tabTokensBtn.addEventListener("click", () => showLeftTab("tokens"));
  tabTemplatesBtn.addEventListener("click", () => showLeftTab("templates"));
  leftTabsNav.appendChild(tabElementsBtn);
  leftTabsNav.appendChild(tabTokensBtn);
  leftTabsNav.appendChild(tabTemplatesBtn);

  const leftAside = doc.createElement("aside");
  leftAside.className = "grex-studio-left";
  leftAside.setAttribute("aria-label", "Palette, Structure, Tokens and Templates");
  leftAside.appendChild(leftTabsNav);
  leftAside.appendChild(paletteContainer.element);
  leftAside.appendChild(structureNav);
  leftAside.appendChild(themeTokensSection);
  leftAside.appendChild(templatesSection);

  // --- Center Split-Screen Live Preview Pane ---
  const previewSection = doc.createElement("main");
  previewSection.className = "grex-studio-preview";
  previewSection.setAttribute("aria-label", "Live Visual Preview");

  const viewportBadge = doc.createElement("span");
  viewportBadge.id = "grex-viewport-badge";
  viewportBadge.className = "grex-viewport-badge";
  previewSection.appendChild(viewportBadge);

  const previewFrame = doc.createElement("iframe");
  previewFrame.id = "grex-preview-iframe";
  previewFrame.className = "grex-preview-iframe";
  previewFrame.setAttribute("title", "Live Grex Theme Preview");
  previewFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  if (options.previewSrc) {
    previewFrame.setAttribute("src", options.previewSrc);
  }
  previewSection.appendChild(previewFrame);

  const previewClient = createStudioPreviewClient({
    targetOrigin: previewOrigin,
    store,
    postMessage(msg, origin) {
      if (previewFrame.contentWindow && typeof previewFrame.contentWindow.postMessage === "function") {
        previewFrame.contentWindow.postMessage(msg, origin);
      }
    },
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    const onPreviewReady = (ev) => {
      if (ev.origin !== previewOrigin) {
        return;
      }
      if (ev.data && ev.data.type === "preview-ready") {
        previewClient.syncTree(store.activeSlot.peek(), store.documentTree.peek());
        previewClient.syncSelected(store.selectedNodeId.peek());
        if (store.previewContext) {
          previewClient.syncContext(store.previewContext.peek());
        }
        const css = store.compiledCss.peek();
        previewClient.syncStyles({
          tokensCss: css.tokensCss,
          classesCss: css.classesCss || "",
          elementsCss: css.elementCss || "",
          themeMode: store.activeThemeMode.peek(),
        });
      }
    };
    window.addEventListener("message", onPreviewReady);
    disposers.push(() => window.removeEventListener("message", onPreviewReady));
  }

  // --- Right Sidebar: Property & WCAG AA Accessibility Inspector ---
  const inspectorAside = doc.createElement("aside");
  inspectorAside.id = "grex-inspector-panel";
  inspectorAside.className = "grex-studio-inspector";
  inspectorAside.setAttribute("aria-label", "Element Inspector and Accessibility Audit");

  const workspace = Section(
    {
      id: "grex-studio-workspace",
      tag: "section",
      className: "grex-studio-workspace",
      props: { label: "Studio Workspace" },
      children: [],
    },
    { document: doc }
  );
  workspace.element.appendChild(leftAside);
  workspace.element.appendChild(previewSection);
  workspace.element.appendChild(inspectorAside);

  root.appendChild(topbar.element);
  root.appendChild(workspace.element);

  // --- Reactive Structure Tree Renderer ---
  function buildTreeList(node, parentId, siblingIndex, siblingCount) {
    const li = doc.createElement("li");
    const nid = getNodeId(node);
    const elType = getNodeElementType(node);
    const tag = getNodeTag(node);
    const isSelected = store.selectedNodeId.get() === nid;

    const row = doc.createElement("section");
    row.className = isSelected ? "grex-tree-row is-selected" : "grex-tree-row";
    row.setAttribute("data-node-id", nid);

    const selectBtn = doc.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "grex-tree-select";
    if (isSelected) {
      selectBtn.setAttribute("aria-current", "true");
    }
    setSafeText(selectBtn, `${elType} <${tag}>`);
    selectBtn.addEventListener("click", () => store.selectNode(nid));

    row.addEventListener("dragover", (ev) => {
      ev.preventDefault();
    });
    row.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const dropType =
        draggedElementType ||
        (ev.dataTransfer && typeof ev.dataTransfer.getData === "function"
          ? ev.dataTransfer.getData("text/plain")
          : "");
      draggedElementType = null;
      if (dropType && ELEMENT_CATALOG.elements[dropType]) {
        const meta = ELEMENT_CATALOG.elements[dropType];
        const canAccept = elType === "Fragment" || (ELEMENT_CATALOG.elements[elType]?.acceptsChildren);
        const targetParent = canAccept ? nid : parentId;
        if (targetParent) {
          store.insertElement(meta.name, targetParent);
        }
      }
    });

    row.appendChild(selectBtn);

    if (parentId) {
      const upBtn = doc.createElement("button");
      upBtn.type = "button";
      upBtn.className = "grex-tree-action";
      upBtn.setAttribute("aria-label", `Move ${elType} up`);
      setSafeText(upBtn, "↑");
      upBtn.disabled = siblingIndex <= 0;
      upBtn.addEventListener("click", () => {
        store.moveElement(nid, parentId, Math.max(0, siblingIndex - 1));
      });

      const downBtn = doc.createElement("button");
      downBtn.type = "button";
      downBtn.className = "grex-tree-action";
      downBtn.setAttribute("aria-label", `Move ${elType} down`);
      setSafeText(downBtn, "↓");
      downBtn.disabled = siblingIndex >= siblingCount - 1;
      downBtn.addEventListener("click", () => {
        store.moveElement(nid, parentId, Math.min(siblingCount - 1, siblingIndex + 1));
      });

      const delBtn = doc.createElement("button");
      delBtn.type = "button";
      delBtn.className = "grex-tree-action is-danger";
      delBtn.setAttribute("aria-label", `Delete ${elType}`);
      setSafeText(delBtn, "×");
      delBtn.addEventListener("click", () => {
        store.deleteElement(nid);
      });

      row.appendChild(upBtn);
      row.appendChild(downBtn);
      row.appendChild(delBtn);
    }

    li.appendChild(row);

    if (Array.isArray(node.children) && node.children.length > 0) {
      const ul = doc.createElement("ul");
      ul.className = "grex-tree-children";
      for (let i = 0; i < node.children.length; i += 1) {
        ul.appendChild(buildTreeList(node.children[i], nid, i, node.children.length));
      }
      li.appendChild(ul);
    }
    return li;
  }

  function appendLabeledField(container, id, labelText, inputEl) {
    const label = doc.createElement("label");
    label.className = "grex-field";
    label.setAttribute("for", id);
    const span = doc.createElement("span");
    setSafeText(span, labelText);
    inputEl.id = id;
    label.appendChild(span);
    label.appendChild(inputEl);
    container.appendChild(label);
  }

  disposers.push(
    effect(() => {
      slotSelectEl.value = store.activeSlot.get();
      undoBtn.element.disabled = !store.canUndo.get();
      redoBtn.element.disabled = !store.canRedo.get();

      const bp = store.activeBreakpoint.get();
      const bpInfo = BREAKPOINT_META[bp] || BREAKPOINT_META.base;
      for (const [k, btn] of Object.entries(bpButtons)) {
        btn.className = k === bp ? "grex-bp-btn is-active" : "grex-bp-btn";
        btn.setAttribute("aria-pressed", k === bp ? "true" : "false");
      }
      previewFrame.style.width = bpInfo.width;
      previewSection.setAttribute("data-breakpoint", bp);
      setSafeText(viewportBadge, `${bpInfo.label} (${bpInfo.badge})`);

      const tMode = store.activeThemeMode.get();
      setSafeText(themeModeBtn, tMode === "dark" ? "Mode: Dark" : "Mode: Light");
      themeModeBtn.setAttribute("data-theme-mode", tMode);

      const status = store.saveStatus.get();
      const dirty = store.isDirty.get();
      const err = store.lastError.get();
      const statusText = err
        ? `Error: ${err}`
        : dirty
          ? "Unsaved changes"
          : status === "published"
            ? "Published"
            : status === "saved"
              ? "Draft saved"
              : "Ready";
      setSafeText(statusBadge.element, statusText);

      const diag = store.validationReport.get();
      const contrastWarns = store.contrastWarnings.get();
      const tplConflicts = store.templateConflicts ? store.templateConflicts.get() : [];
      const totalWarns = diag.warnings.length + contrastWarns.length;
      const totalErrs = diag.errors.length + tplConflicts.length;
      setSafeText(
        a11yBadge.element,
        totalErrs === 0
          ? `WCAG AA: Pass (${totalWarns} warnings)`
          : `WCAG AA: ${totalErrs} error(s)`
      );
      a11yBadge.element.className =
        totalErrs === 0 ? "grex-studio-a11y-badge is-pass" : "grex-studio-a11y-badge is-fail";
    })
  );

  disposers.push(
    effect(() => {
      if (!store.previewContext) {
        return;
      }
      const ctx = store.previewContext.get() || DEFAULT_PREVIEW_CONTEXT;
      const mode = ctx.mode || "front_page";
      previewModeSelect.value = mode;
      const entries = Array.isArray(ctx.entries) ? ctx.entries : DEFAULT_PREVIEW_CONTEXT.entries;
      clearChildren(previewEntrySelect);
      for (const e of entries) {
        const opt = doc.createElement("option");
        opt.value = e.slug;
        opt.textContent = `${e.title} (${e.content_type})`;
        previewEntrySelect.appendChild(opt);
      }
      if (ctx.entry?.slug) {
        previewEntrySelect.value = ctx.entry.slug;
      }
      previewEntrySelect.hidden = mode !== "single";
      previewTermSelect.hidden = mode !== "archive";
      if (ctx.term?.slug) {
        previewTermSelect.value = ctx.term.slug;
      }
    })
  );

  disposers.push(
    effect(() => {
      if (!store.templateRegistry) {
        return;
      }
      const reg = store.templateRegistry.get() || {};
      const conflicts = store.templateConflicts ? store.templateConflicts.get() : [];
      const resolved = store.resolvedActiveTemplate ? store.resolvedActiveTemplate.get() : null;
      const activeSlotName = store.activeSlot.get();
      clearChildren(templatesSection);

      const tplHeading = Heading({ props: { level: 2, text: "Conditional Templates" } }, { document: doc });
      templatesSection.appendChild(tplHeading.element);

      const resolvedBanner = Text(
        {
          props: {
            text: resolved
              ? `Resolved (${activeSlotName}): ${resolved.name || resolved.id} [priority ${resolved.priority ?? 10}]`
              : `No template matched context for slot "${activeSlotName}"`,
          },
        },
        { document: doc }
      );
      resolvedBanner.element.className = "grex-resolved-tpl-banner";
      templatesSection.appendChild(resolvedBanner.element);

      if (conflicts.length > 0) {
        const confList = doc.createElement("ul");
        confList.className = "grex-diag-list";
        for (const c of conflicts) {
          const li = doc.createElement("li");
          li.className = "is-error";
          setSafeText(li, `[${c.code}] ${c.message}`);
          confList.appendChild(li);
        }
        templatesSection.appendChild(confList);
      }

      const newForm = doc.createElement("section");
      newForm.className = "grex-template-create";
      const newNameInput = doc.createElement("input");
      newNameInput.type = "text";
      newNameInput.placeholder = "New template name";
      newNameInput.setAttribute("aria-label", "New Template Name");
      const newSlotSelect = doc.createElement("select");
      newSlotSelect.setAttribute("aria-label", "New Template Slot");
      for (const s of [...TEMPLATE_SLOTS, ...GLOBAL_PART_SLOTS.map((p) => `part:${p}`)]) {
        const opt = doc.createElement("option");
        opt.value = s;
        opt.textContent = s;
        newSlotSelect.appendChild(opt);
      }
      const newCondSelect = doc.createElement("select");
      newCondSelect.setAttribute("aria-label", "New Template Condition");
      for (const ct of CONDITION_TYPES) {
        const opt = doc.createElement("option");
        opt.value = ct;
        opt.textContent = ct;
        newCondSelect.appendChild(opt);
      }
      const createTplBtn = doc.createElement("button");
      createTplBtn.type = "button";
      createTplBtn.id = "grex-create-template-btn";
      setSafeText(createTplBtn, "Create Template");
      const formatCondValue = (condType, rawVal) => {
        const trimmed = String(rawVal || "").trim();
        if (condType === "taxonomy_term") {
          return { taxonomy: "category", term: trimmed || "guides" };
        }
        if (condType === "content_type") {
          return trimmed || "post";
        }
        if (condType === "entry_slug") {
          return trimmed || "getting-started-with-grex";
        }
        return null;
      };

      createTplBtn.addEventListener("click", () => {
        const label = newNameInput.value.trim();
        if (!label) {
          return;
        }
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const slotVal = newSlotSelect.value;
        const cleanSlot = slotVal.startsWith("part:") ? slotVal.slice(5) : slotVal;
        const condType = newCondSelect.value;
        store.createTemplate({
          id: `${cleanSlot}-${slug || Date.now()}`,
          name: label,
          slot: cleanSlot,
          priority: 10,
          conditions: [{ type: condType, value: formatCondValue(condType, ""), operator: "include" }],
        });
      });
      newForm.appendChild(newNameInput);
      newForm.appendChild(newSlotSelect);
      newForm.appendChild(newCondSelect);
      newForm.appendChild(createTplBtn);
      templatesSection.appendChild(newForm);

      for (const tpl of Object.values(reg)) {
        const card = doc.createElement("section");
        card.className =
          resolved && resolved.id === tpl.id ? "grex-template-card is-active" : "grex-template-card";
        card.setAttribute("data-template-id", tpl.id);

        const cardTitle = Heading(
          { props: { level: 3, text: `${tpl.name || tpl.id} (${tpl.slot})` } },
          { document: doc }
        );
        card.appendChild(cardTitle.element);

        const prioInput = doc.createElement("input");
        prioInput.type = "number";
        prioInput.value = String(tpl.priority ?? 10);
        prioInput.addEventListener("change", (ev) => {
          const prio = Number(ev.target.value);
          store.setTemplateConditions(tpl.id, tpl.conditions || [], Number.isFinite(prio) ? prio : 10);
        });
        appendLabeledField(card, `tpl-prio-${tpl.id}`, "Priority", prioInput);

        const firstCond = (tpl.conditions && tpl.conditions[0]) || {
          type: "entire_site",
          value: "",
          operator: "include",
        };
        const condTypeSel = doc.createElement("select");
        for (const ct of CONDITION_TYPES) {
          const opt = doc.createElement("option");
          opt.value = ct;
          opt.textContent = ct;
          condTypeSel.appendChild(opt);
        }
        condTypeSel.value = firstCond.type || "entire_site";

        const condValInput = doc.createElement("input");
        condValInput.type = "text";
        condValInput.placeholder = "slug / type / term";
        condValInput.value =
          firstCond.value && typeof firstCond.value === "object"
            ? firstCond.value.term || firstCond.value.slug || ""
            : (firstCond.value ?? "");

        const condOpSel = doc.createElement("select");
        for (const op of ["include", "exclude"]) {
          const opt = doc.createElement("option");
          opt.value = op;
          opt.textContent = op;
          condOpSel.appendChild(opt);
        }
        condOpSel.value = firstCond.operator || "include";

        const applyCond = () => {
          const rest = Array.isArray(tpl.conditions) ? tpl.conditions.slice(1) : [];
          const nextFirst = {
            type: condTypeSel.value,
            value: formatCondValue(condTypeSel.value, condValInput.value),
            operator: condOpSel.value,
          };
          store.setTemplateConditions(tpl.id, [nextFirst, ...rest], tpl.priority ?? 10);
        };
        condTypeSel.addEventListener("change", applyCond);
        condValInput.addEventListener("change", applyCond);
        condOpSel.addEventListener("change", applyCond);

        appendLabeledField(card, `tpl-cond-type-${tpl.id}`, "Condition Rule", condTypeSel);
        appendLabeledField(card, `tpl-cond-val-${tpl.id}`, "Condition Target Value", condValInput);
        appendLabeledField(card, `tpl-cond-op-${tpl.id}`, "Rule Operator", condOpSel);

        if (!tpl.id.endsWith("-default")) {
          const delBtn = doc.createElement("button");
          delBtn.type = "button";
          delBtn.className = "is-danger";
          setSafeText(delBtn, "Delete Template");
          delBtn.addEventListener("click", () => store.deleteTemplate(tpl.id));
          card.appendChild(delBtn);
        }
        templatesSection.appendChild(card);
      }
    })
  );

  disposers.push(
    effect(() => {
      const cfg = store.themeConfig.get();
      const cWarnings = store.contrastWarnings.get();
      clearChildren(themeTokensSection);

      const tHeading = Heading({ props: { level: 2, text: "Theme Tokens" } }, { document: doc });
      themeTokensSection.appendChild(tHeading.element);

      const modeSelect = doc.createElement("select");
      modeSelect.id = "grex-token-mode-select";
      for (const [mKey, mLabel] of [
        ["base", "Base (:root)"],
        ["light", "Light Mode"],
        ["dark", "Dark Mode"],
      ]) {
        const opt = doc.createElement("option");
        opt.value = mKey;
        opt.textContent = mLabel;
        modeSelect.appendChild(opt);
      }
      modeSelect.value = activeTokenEditMode;
      modeSelect.addEventListener("change", (ev) => {
        activeTokenEditMode = ev.target.value;
        if (activeTokenEditMode === "light" || activeTokenEditMode === "dark") {
          store.setThemeMode(activeTokenEditMode);
        }
      });
      appendLabeledField(themeTokensSection, "grex-token-mode-select", "Token Scope", modeSelect);

      const prefLabel = doc.createElement("label");
      prefLabel.className = "grex-field-inline";
      const prefCheck = doc.createElement("input");
      prefCheck.type = "checkbox";
      prefCheck.checked = Boolean(cfg.prefersColorScheme);
      prefCheck.addEventListener("change", (ev) => {
        store.setThemeToken("preferences", "prefersColorScheme", ev.target.checked);
      });
      const prefSpan = doc.createElement("span");
      setSafeText(prefSpan, "Enable @media (prefers-color-scheme: dark)");
      prefLabel.appendChild(prefCheck);
      prefLabel.appendChild(prefSpan);
      themeTokensSection.appendChild(prefLabel);

      if (cWarnings.length > 0) {
        const warnList = doc.createElement("ul");
        warnList.className = "grex-diag-list";
        for (const w of cWarnings) {
          const li = doc.createElement("li");
          li.className = "is-warning";
          setSafeText(li, `[${w.code}] ${w.message}`);
          warnList.appendChild(li);
        }
        themeTokensSection.appendChild(warnList);
      }

      const activeMap =
        activeTokenEditMode === "base"
          ? cfg.tokens || {}
          : { ...(cfg.tokens || {}), ...(cfg.modes?.[activeTokenEditMode] || {}) };

      for (const group of THEME_TOKEN_GROUPS) {
        const gHead = Heading({ props: { level: 3, text: group.title } }, { document: doc });
        themeTokensSection.appendChild(gHead.element);
        for (const tok of group.tokens) {
          const inp = doc.createElement("input");
          inp.type = "text";
          inp.value = activeMap[tok] ?? "";
          inp.setAttribute("data-token", tok);
          inp.addEventListener("change", (ev) => {
            store.setThemeToken(activeTokenEditMode, tok, ev.target.value);
          });
          appendLabeledField(themeTokensSection, `tok-${activeTokenEditMode}-${tok}`, tok, inp);
        }
      }
    })
  );

  disposers.push(
    effect(() => {
      const rootNode = store.activeSlotTree.get();
      clearChildren(structureNav);
      const heading = Heading({ props: { level: 2, text: "Structure Tree" } }, { document: doc });
      structureNav.appendChild(heading.element);
      if (rootNode) {
        const ul = doc.createElement("ul");
        ul.className = "grex-tree-root";
        ul.appendChild(buildTreeList(rootNode, null, 0, 1));
        structureNav.appendChild(ul);
      }
    })
  );

  const mediaDialog = doc.createElement("dialog");
  mediaDialog.id = "grex-media-dialog";
  mediaDialog.className = "grex-media-dialog";
  mediaDialog.setAttribute("aria-label", "Media Library Picker");
  root.appendChild(mediaDialog);

  function closeMediaDialog() {
    if (typeof mediaDialog.close === "function") {
      mediaDialog.close();
    } else {
      mediaDialog.open = false;
    }
  }

  async function openMediaLibraryPicker(nodeId, currentProps = {}) {
    clearChildren(mediaDialog);
    const dlgTitle = Heading({ props: { level: 3, text: "Media Library Picker" } }, { document: doc });
    mediaDialog.appendChild(dlgTitle.element);

    let items = [];
    if (transport && typeof transport.listMedia === "function") {
      const res = await transport.listMedia();
      if (res && res.ok && res.data && Array.isArray(res.data.media)) {
        items = res.data.media;
      }
    }
    if (items.length === 0) {
      const ctxNow = store.previewContext ? store.previewContext.peek() : null;
      items = (ctxNow && Array.isArray(ctxNow.media) && ctxNow.media) || [
        {
          id: "media-hero-01",
          url: "/static/theme/preview-hero.svg",
          alt: "Grex Theme Builder modular canvas overview",
          width: 1200,
          height: 630,
          decorative: false,
        },
        {
          id: "media-card-02",
          url: "/static/theme/preview-card.svg",
          alt: "Responsive component tokens showcase",
          width: 800,
          height: 500,
          decorative: false,
        },
      ];
    }

    const altInput = doc.createElement("input");
    altInput.type = "text";
    altInput.value = currentProps.alt ?? "";
    altInput.placeholder = "Describe image for screen readers (WCAG AA)";
    appendLabeledField(mediaDialog, "grex-media-alt-input", "Alt Text (Required unless decorative)", altInput);

    const decoLabel = doc.createElement("label");
    decoLabel.className = "grex-field-inline";
    const decoCheck = doc.createElement("input");
    decoCheck.type = "checkbox";
    decoCheck.id = "grex-media-deco-check";
    decoCheck.checked = Boolean(currentProps.isDecorative || currentProps.decorative);
    const decoSpan = doc.createElement("span");
    setSafeText(decoSpan, "Mark as decorative (alt=\"\", aria-hidden=\"true\")");
    decoLabel.appendChild(decoCheck);
    decoLabel.appendChild(decoSpan);
    mediaDialog.appendChild(decoLabel);

    const listEl = doc.createElement("ul");
    listEl.className = "grex-media-grid";
    for (const asset of items) {
      const li = doc.createElement("li");
      const pickBtn = doc.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "grex-media-item";
      pickBtn.setAttribute("data-media-id", String(asset.id || asset.url));
      setSafeText(
        pickBtn,
        `${asset.id || "asset"} — ${asset.alt || "(decorative)"} (${asset.width || 0}x${asset.height || 0})`
      );
      pickBtn.addEventListener("click", () => {
        const isDeco = decoCheck.checked || Boolean(asset.decorative && !altInput.value.trim());
        const resolvedAlt = isDeco ? "" : altInput.value.trim() || asset.alt || "";
        store.bindMediaAsset(nodeId, {
          mediaId: asset.id,
          src: asset.url || asset.src,
          alt: resolvedAlt,
          width: asset.width,
          height: asset.height,
          isDecorative: isDeco,
        });
        closeMediaDialog();
      });
      li.appendChild(pickBtn);
      listEl.appendChild(li);
    }
    mediaDialog.appendChild(listEl);

    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    setSafeText(closeBtn, "Close");
    closeBtn.addEventListener("click", closeMediaDialog);
    mediaDialog.appendChild(closeBtn);

    if (typeof mediaDialog.showModal === "function") {
      mediaDialog.showModal();
    } else {
      mediaDialog.open = true;
    }
  }

  disposers.push(
    effect(() => {
      const node = store.selectedNode.get();
      const diag = store.validationReport.get();
      const bp = store.activeBreakpoint.get();
      const clsReg = store.classRegistry.get();
      const activeCls = store.activeClassName.get();
      const cWarnings = store.contrastWarnings.get();
      clearChildren(inspectorAside);

      const heading = Heading({ props: { level: 2, text: "Inspector" } }, { document: doc });
      inspectorAside.appendChild(heading.element);

      if (!node) {
        const emptyMsg = Text({ props: { text: "Select an element in the Structure Tree." } }, { document: doc });
        inspectorAside.appendChild(emptyMsg.element);
      } else {
        const nid = getNodeId(node);
        const elType = getNodeElementType(node);
        const meta = ELEMENT_CATALOG.elements[elType];
        const summary = Text(
          { props: { text: `${elType} (#${nid})` } },
          { document: doc }
        );
        inspectorAside.appendChild(summary.element);

        // --- Bricks-Style Reusable Class Manager ---
        const classBar = doc.createElement("section");
        classBar.id = "grex-class-manager-bar";
        classBar.className = "grex-class-manager";
        classBar.setAttribute("aria-label", "Reusable Classes");
        const clsHeading = Heading({ props: { level: 3, text: "Reusable Classes (.grex-c-*)" } }, { document: doc });
        classBar.appendChild(clsHeading.element);

        const attachedClasses = getNodeGrexClasses(node);
        const pillsList = doc.createElement("ul");
        pillsList.className = "grex-class-pills";
        for (const clsName of attachedClasses) {
          const li = doc.createElement("li");
          const pillBtn = doc.createElement("button");
          pillBtn.type = "button";
          pillBtn.className = activeCls === clsName ? "grex-class-pill is-active" : "grex-class-pill";
          setSafeText(pillBtn, `.grex-c-${clsName}`);
          pillBtn.addEventListener("click", () => {
            store.setActiveClass(activeCls === clsName ? null : clsName);
          });
          const detachBtn = doc.createElement("button");
          detachBtn.type = "button";
          detachBtn.className = "grex-class-detach";
          detachBtn.setAttribute("aria-label", `Detach class ${clsName}`);
          setSafeText(detachBtn, "×");
          detachBtn.addEventListener("click", () => {
            if (activeCls === clsName) {
              store.setActiveClass(null);
            }
            store.assignClass(nid, clsName, false);
          });
          li.appendChild(pillBtn);
          li.appendChild(detachBtn);
          pillsList.appendChild(li);
        }
        classBar.appendChild(pillsList);

        const createRow = doc.createElement("section");
        createRow.className = "grex-class-controls";
        const newClsInput = doc.createElement("input");
        newClsInput.type = "text";
        newClsInput.id = "grex-new-class-input";
        newClsInput.placeholder = "new-class-slug";
        newClsInput.setAttribute("aria-label", "New Class Slug");
        const createClsBtn = doc.createElement("button");
        createClsBtn.type = "button";
        setSafeText(createClsBtn, "Create Class");
        createClsBtn.addEventListener("click", () => {
          const slug = newClsInput.value.trim();
          if (slug) {
            store.createClass(slug, {}, true);
          }
        });
        createRow.appendChild(newClsInput);
        createRow.appendChild(createClsBtn);
        classBar.appendChild(createRow);

        const allClassNames = Object.keys(clsReg || {});
        if (allClassNames.length > 0) {
          const attachRow = doc.createElement("section");
          attachRow.className = "grex-class-controls";
          const clsSelect = doc.createElement("select");
          clsSelect.setAttribute("aria-label", "Attach Existing Class");
          for (const cName of allClassNames) {
            const opt = doc.createElement("option");
            opt.value = cName;
            opt.textContent = `.grex-c-${cName}`;
            clsSelect.appendChild(opt);
          }
          const attachBtn = doc.createElement("button");
          attachBtn.type = "button";
          setSafeText(attachBtn, "Attach");
          attachBtn.addEventListener("click", () => {
            if (clsSelect.value) {
              store.assignClass(nid, clsSelect.value, true);
              store.setActiveClass(clsSelect.value);
            }
          });
          attachRow.appendChild(clsSelect);
          attachRow.appendChild(attachBtn);
          classBar.appendChild(attachRow);
        }

        if (activeCls && clsReg[activeCls]) {
          const activeBanner = doc.createElement("section");
          activeBanner.className = "grex-active-class-banner";
          const bannerTxt = Text({ props: { text: `Editing Class: .grex-c-${activeCls}` } }, { document: doc });
          const dupBtn = doc.createElement("button");
          dupBtn.type = "button";
          setSafeText(dupBtn, "Duplicate");
          dupBtn.addEventListener("click", () => {
            let copyName = `${activeCls}-copy`;
            let n = 2;
            while (copyName in (store.classRegistry.peek() || {})) {
              copyName = `${activeCls}-copy-${n}`;
              n += 1;
            }
            store.duplicateClass(activeCls, copyName, true);
          });
          const clearClsBtn = doc.createElement("button");
          clearClsBtn.type = "button";
          setSafeText(clearClsBtn, "Edit Element ID");
          clearClsBtn.addEventListener("click", () => store.setActiveClass(null));
          const delClsBtn = doc.createElement("button");
          delClsBtn.type = "button";
          delClsBtn.className = "is-danger";
          setSafeText(delClsBtn, "Delete Class");
          delClsBtn.addEventListener("click", () => store.deleteClass(activeCls));

          activeBanner.appendChild(bannerTxt.element);
          activeBanner.appendChild(dupBtn);
          activeBanner.appendChild(clearClsBtn);
          activeBanner.appendChild(delClsBtn);
          classBar.appendChild(activeBanner);
        }
        inspectorAside.appendChild(classBar);

        if (meta && meta.allowedTags.length > 0) {
          const tagSelect = doc.createElement("select");
          for (const t of meta.allowedTags) {
            const opt = doc.createElement("option");
            opt.value = t;
            opt.textContent = `<${t}>`;
            tagSelect.appendChild(opt);
          }
          tagSelect.value = getNodeTag(node);
          tagSelect.addEventListener("change", (ev) => {
            store.updateNodeTag(nid, ev.target.value);
          });
          appendLabeledField(inspectorAside, `prop-tag-${nid}`, "Semantic HTML Tag", tagSelect);
        }

        const props = node.props || {};
        if (elType === "Heading") {
          const lvlSelect = doc.createElement("select");
          for (let lvl = 1; lvl <= 6; lvl += 1) {
            const opt = doc.createElement("option");
            opt.value = String(lvl);
            opt.textContent = `h${lvl}`;
            lvlSelect.appendChild(opt);
          }
          lvlSelect.value = String(props.level ?? 2);
          lvlSelect.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { level: Number(ev.target.value) });
          });
          appendLabeledField(inspectorAside, `prop-level-${nid}`, "Heading Level", lvlSelect);
        }

        if ("text" in props || ["Heading", "Text", "RichText", "Link", "Button"].includes(elType)) {
          const textInput = doc.createElement("input");
          textInput.type = "text";
          textInput.value = props.text ?? "";
          textInput.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { text: ev.target.value });
            previewClient.patchText(nid, ev.target.value);
          });
          appendLabeledField(inspectorAside, `prop-text-${nid}`, "Text Content", textInput);
        }

        if (elType === "Link") {
          const hrefInput = doc.createElement("input");
          hrefInput.type = "text";
          hrefInput.value = props.href ?? "/";
          hrefInput.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { href: ev.target.value });
            previewClient.patchAttr(nid, "href", ev.target.value);
          });
          appendLabeledField(inspectorAside, `prop-href-${nid}`, "Link URL (href)", hrefInput);
        }

        if (elType === "Image") {
          const srcInput = doc.createElement("input");
          srcInput.type = "text";
          srcInput.value = props.src ?? "";
          srcInput.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { src: ev.target.value });
            previewClient.patchAttr(nid, "src", ev.target.value);
          });
          appendLabeledField(inspectorAside, `prop-src-${nid}`, "Image Source (src)", srcInput);

          const altInput = doc.createElement("input");
          altInput.type = "text";
          altInput.value = props.alt ?? "";
          altInput.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { alt: ev.target.value });
            previewClient.patchAttr(nid, "alt", ev.target.value);
          });
          appendLabeledField(inspectorAside, `prop-alt-${nid}`, "Alt Text (WCAG AA)", altInput);

          const decoField = doc.createElement("label");
          decoField.className = "grex-field-inline";
          const decoToggle = doc.createElement("input");
          decoToggle.type = "checkbox";
          decoToggle.id = `prop-deco-${nid}`;
          decoToggle.checked = Boolean(props.is_decorative || props.decorative || node.decorative);
          decoToggle.addEventListener("change", (ev) => {
            const isDeco = Boolean(ev.target.checked);
            store.bindMediaAsset(nid, {
              mediaId: props.mediaId || node.mediaId || null,
              src: props.src || "",
              alt: isDeco ? "" : props.alt || "",
              width: props.width,
              height: props.height,
              isDecorative: isDeco,
            });
          });
          const decoTxt = doc.createElement("span");
          setSafeText(decoTxt, "Decorative Image (aria-hidden)");
          decoField.appendChild(decoToggle);
          decoField.appendChild(decoTxt);
          inspectorAside.appendChild(decoField);

          const browseMediaBtn = doc.createElement("button");
          browseMediaBtn.type = "button";
          browseMediaBtn.id = "studio-media-picker-btn";
          setSafeText(browseMediaBtn, "Browse Media Library");
          browseMediaBtn.addEventListener("click", () => {
            void openMediaLibraryPicker(nid, {
              alt: props.alt,
              isDecorative: Boolean(props.is_decorative || props.decorative),
            });
          });
          inspectorAside.appendChild(browseMediaBtn);
        }

        if (elType === "Nav") {
          const navSection = doc.createElement("section");
          navSection.id = "grex-nav-menu-picker";
          navSection.className = "grex-inspector-subpanel";
          navSection.setAttribute("aria-label", "Navigation Menu Picker");
          const navHeading = Heading({ props: { level: 3, text: "Navigation Menu (/api/menus)" } }, { document: doc });
          navSection.appendChild(navHeading.element);

          const locSelect = doc.createElement("select");
          for (const loc of ["primary", "footer", "mobile"]) {
            const opt = doc.createElement("option");
            opt.value = loc;
            opt.textContent = `${loc} menu`;
            locSelect.appendChild(opt);
          }
          locSelect.value = props.location || "primary";
          appendLabeledField(navSection, `prop-nav-loc-${nid}`, "Menu Location", locSelect);

          const bindMenuForLoc = async (loc) => {
            let items = null;
            if (transport && typeof transport.getMenu === "function") {
              const res = await transport.getMenu(loc);
              if (res && res.ok && res.data && Array.isArray(res.data.menu)) {
                items = res.data.menu;
              }
            }
            if (!items) {
              const ctxMenus = store.previewContext?.peek()?.menus || DEFAULT_PREVIEW_CONTEXT.menus;
              items = ctxMenus[loc] || DEFAULT_PREVIEW_CONTEXT.menus.primary;
            }
            store.bindNavigationMenu(nid, loc, items);
          };

          locSelect.addEventListener("change", (ev) => {
            void bindMenuForLoc(ev.target.value);
          });
          const loadMenuBtn = doc.createElement("button");
          loadMenuBtn.type = "button";
          loadMenuBtn.id = "studio-bind-menu-btn";
          setSafeText(loadMenuBtn, "Load & Bind Menu");
          loadMenuBtn.addEventListener("click", () => {
            void bindMenuForLoc(locSelect.value);
          });
          navSection.appendChild(loadMenuBtn);
          inspectorAside.appendChild(navSection);
        }

        if (elType === "Input" || elType === "Select") {
          const lblInput = doc.createElement("input");
          lblInput.type = "text";
          lblInput.value = props.label ?? "";
          lblInput.addEventListener("change", (ev) => {
            store.updateNodeProps(nid, { label: ev.target.value });
          });
          appendLabeledField(inspectorAside, `prop-label-${nid}`, "Accessible Label", lblInput);
        }

        if (["Heading", "Text", "RichText", "Link", "Button", "Image"].includes(elType)) {
          const dynSection = doc.createElement("section");
          dynSection.id = "grex-dynamic-picker";
          dynSection.className = "grex-inspector-subpanel";
          dynSection.setAttribute("aria-label", "Dynamic Data Bindings");
          const dynHeading = Heading({ props: { level: 3, text: "Dynamic Data Picker" } }, { document: doc });
          dynSection.appendChild(dynHeading.element);

          const bindableProps =
            elType === "Image"
              ? ["src", "alt"]
              : elType === "Link"
                ? ["text", "href"]
                : ["text"];
          const propSelect = doc.createElement("select");
          for (const bpName of bindableProps) {
            const opt = doc.createElement("option");
            opt.value = bpName;
            opt.textContent = bpName;
            propSelect.appendChild(opt);
          }
          appendLabeledField(dynSection, `dyn-prop-${nid}`, "Target Property", propSelect);

          const tokenSelect = doc.createElement("select");
          for (const [tokVal, tokLabel] of [
            ["entry.title", "entry.title"],
            ["entry.slug", "entry.slug"],
            ["entry.full_path", "entry.full_path"],
            ["entry.excerpt", "entry.excerpt"],
            ["entry.published_at", "entry.published_at"],
            ["entry.author_name", "entry.author_name"],
            ["entry.custom_fields.price", "entry.custom_fields.price"],
            ["term.name", "term.name"],
            ["site.title", "site.title"],
            ["site.tagline", "site.tagline"],
          ]) {
            const opt = doc.createElement("option");
            opt.value = tokVal;
            opt.textContent = tokLabel;
            tokenSelect.appendChild(opt);
          }
          appendLabeledField(dynSection, `dyn-token-${nid}`, "Dynamic Field Source", tokenSelect);

          const bindBtn = doc.createElement("button");
          bindBtn.type = "button";
          bindBtn.id = "studio-bind-dynamic-btn";
          setSafeText(bindBtn, "Bind Field");
          bindBtn.addEventListener("click", () => {
            store.bindDynamicField(nid, propSelect.value, `{{ ${tokenSelect.value} }}`);
          });
          dynSection.appendChild(bindBtn);

          const bindings = node.bindings || {};
          const boundKeys = Object.keys(bindings);
          if (boundKeys.length > 0) {
            const chipList = doc.createElement("ul");
            chipList.className = "grex-binding-chips";
            for (const bk of boundKeys) {
              const li = doc.createElement("li");
              const clearB = doc.createElement("button");
              clearB.type = "button";
              setSafeText(clearB, `Unbind ${bk}: ${bindings[bk]}`);
              clearB.addEventListener("click", () => {
                store.bindDynamicField(nid, bk, "");
              });
              li.appendChild(clearB);
              chipList.appendChild(li);
            }
            dynSection.appendChild(chipList);
          }
          inspectorAside.appendChild(dynSection);
        }

        if (["Grid", "Stack", "Section", "ForEach"].includes(elType)) {
          const ql = node.queryLoop || {};
          const qlSection = doc.createElement("section");
          qlSection.id = "grex-query-loop-panel";
          qlSection.className = "grex-inspector-subpanel";
          qlSection.setAttribute("aria-label", "Visual Query Loop Builder");
          const qlHeading = Heading({ props: { level: 3, text: "Query Loop (ForEach)" } }, { document: doc });
          qlSection.appendChild(qlHeading.element);

          const qlToggleLbl = doc.createElement("label");
          qlToggleLbl.className = "grex-field-inline";
          const qlCheck = doc.createElement("input");
          qlCheck.type = "checkbox";
          qlCheck.id = `grex-ql-enabled-${nid}`;
          qlCheck.checked = Boolean(ql.enabled);
          const qlSpan = doc.createElement("span");
          setSafeText(qlSpan, "Bind Container to Query Entries");
          qlToggleLbl.appendChild(qlCheck);
          qlToggleLbl.appendChild(qlSpan);
          qlSection.appendChild(qlToggleLbl);

          const ctSelect = doc.createElement("select");
          for (const [val, lbl] of [
            ["", "All Content Types"],
            ["post", "Posts (post)"],
            ["page", "Pages (page)"],
            ["product", "Products (product)"],
          ]) {
            const opt = doc.createElement("option");
            opt.value = val;
            opt.textContent = lbl;
            ctSelect.appendChild(opt);
          }
          ctSelect.value = ql.content_type || "";
          appendLabeledField(qlSection, `ql-ct-${nid}`, "Content Type", ctSelect);

          const termInput = doc.createElement("input");
          termInput.type = "text";
          termInput.placeholder = "e.g. guides";
          termInput.value =
            typeof ql.filter_by_term === "object" && ql.filter_by_term
              ? ql.filter_by_term.slug || ""
              : String(ql.filter_by_term || "");
          appendLabeledField(qlSection, `ql-term-${nid}`, "Filter by Term Slug", termInput);

          const perPageInput = doc.createElement("input");
          perPageInput.type = "number";
          perPageInput.value = String(ql.per_page ?? 6);
          appendLabeledField(qlSection, `ql-per-page-${nid}`, "Items Per Page", perPageInput);

          const sortDirSelect = doc.createElement("select");
          for (const [sv, sl] of [
            ["desc", "Newest first (desc)"],
            ["asc", "Oldest first (asc)"],
          ]) {
            const opt = doc.createElement("option");
            opt.value = sv;
            opt.textContent = sl;
            sortDirSelect.appendChild(opt);
          }
          sortDirSelect.value = ql.order_dir || "desc";
          appendLabeledField(qlSection, `ql-sort-dir-${nid}`, "Sort Order", sortDirSelect);

          const saveQl = () => {
            if (!qlCheck.checked) {
              store.configureQueryLoop(nid, null);
              return;
            }
            const pp = Number(perPageInput.value);
            const termSlug = termInput.value.trim();
            store.configureQueryLoop(nid, {
              enabled: true,
              content_type: ctSelect.value,
              filter_by_term: termSlug ? { taxonomy: "category", slug: termSlug } : null,
              per_page: Number.isFinite(pp) && pp > 0 ? pp : 6,
              order_by: ql.order_by || "published_at",
              order_dir: sortDirSelect.value,
            });
          };
          qlCheck.addEventListener("change", saveQl);
          ctSelect.addEventListener("change", saveQl);
          termInput.addEventListener("change", saveQl);
          perPageInput.addEventListener("change", saveQl);
          sortDirSelect.addEventListener("change", saveQl);

          inspectorAside.appendChild(qlSection);
        }

        // --- Structured Visual Style Inspector (Scoped to activeBreakpoint & Class/Node) ---
        const styleTargetObj = activeCls && clsReg[activeCls] ? clsReg[activeCls] : (node.styles || {});
        const bpStyles = styleTargetObj[bp] || {};
        const baseFallbackStyles = styleTargetObj.base || {};
        const bpInfo = BREAKPOINT_META[bp] || BREAKPOINT_META.base;
        const targetLabel = activeCls ? `.grex-c-${activeCls}` : `#${nid}`;

        const styleSectionHeading = Heading(
          { props: { level: 3, text: `Styles (${targetLabel} · ${bpInfo.label})` } },
          { document: doc }
        );
        inspectorAside.appendChild(styleSectionHeading.element);

        for (const group of INSPECTOR_STYLE_GROUPS) {
          const grpHead = Heading({ props: { level: 4, text: group.title } }, { document: doc });
          inspectorAside.appendChild(grpHead.element);
          for (const [styleProp, label] of group.props) {
            if (!SUPPORTED_STYLE_PROPS.includes(styleProp)) {
              continue;
            }
            const hasOverride = bp !== "base" && styleProp in bpStyles;
            const displayLabel = hasOverride ? `● ${label}` : label;
            const styleInput = doc.createElement("input");
            styleInput.type = "text";
            styleInput.value = bpStyles[styleProp] ?? (bp !== "base" ? baseFallbackStyles[styleProp] ?? "" : "");
            styleInput.setAttribute("data-style-prop", styleProp);
            styleInput.setAttribute("data-breakpoint", bp);
            styleInput.addEventListener("change", (ev) => {
              store.setBreakpointStyle({ [styleProp]: ev.target.value });
            });
            appendLabeledField(
              inspectorAside,
              `style-${bp}-${activeCls || nid}-${styleProp}`,
              displayLabel,
              styleInput
            );
          }
        }
      }

      const diagHeading = Heading(
        { props: { level: 3, text: "Accessibility & Validation" } },
        { document: doc }
      );
      inspectorAside.appendChild(diagHeading.element);

      const diagList = doc.createElement("ul");
      diagList.className = "grex-diag-list";
      const allIssues = [
        ...diag.issues,
        ...cWarnings.map((w) => ({ severity: "warning", code: w.code, message: w.message })),
      ];
      if (allIssues.length === 0) {
        const li = doc.createElement("li");
        setSafeText(li, "All WCAG AA & Grex schema checks passed.");
        diagList.appendChild(li);
      } else {
        for (const issue of allIssues) {
          const li = doc.createElement("li");
          li.className = issue.severity === "error" ? "is-error" : "is-warning";
          setSafeText(li, `[${issue.code}] ${issue.message}`);
          diagList.appendChild(li);
        }
      }
      inspectorAside.appendChild(diagList);
    })
  );

  return {
    previewClient,
    previewFrame,
    dispose() {
      previewClient.dispose();
      for (const fn of disposers) {
        fn();
      }
      disposers.length = 0;
      topbar.dispose();
      workspace.dispose();
    },
  };
}

function readJsonMeta(name, fallback) {
  const el = typeof document !== "undefined" ? document.querySelector(`meta[name="${name}"]`) : null;
  if (!el) {
    return fallback;
  }
  try {
    return JSON.parse(el.getAttribute("content") || "");
  } catch {
    return fallback;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const boot = async () => {
    const root = document.getElementById("grex-studio-root");
    if (!root) {
      return;
    }
    const { createBuilderStore } = await import("./store.js");
    const initialDoc = readJsonMeta("grex-studio-doc", null);
    if (!initialDoc) {
      return;
    }
    const store = createBuilderStore(initialDoc);
    const activeSlot = store.activeSlot.peek();
    mountBuilderStudio({
      root,
      document,
      store,
      previewOrigin: window.location.origin,
      previewSrc: `/preview/${encodeURIComponent(activeSlot)}?mode=draft`,
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    });
  } else {
    void boot();
  }
}
