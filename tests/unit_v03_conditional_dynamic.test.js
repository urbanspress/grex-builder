import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GrexSecurityError } from "../theme/assets/grex.js";
import { createBuilderStore } from "../theme/assets/store.js";
import { evaluateSlotDiagnostics, extractPartsMap } from "../theme/assets/schema.js";
import {
  DEFAULT_PREVIEW_CONTEXT,
  detectTemplateConflicts,
  resolveTemplateForContext,
  resolveDynamicExpression,
  resolveDynamicProps,
  filterPreviewEntries,
} from "../theme/assets/templates.js";
import { mountBuilderStudio } from "../theme/assets/studio.js";
import { mountPreviewHost } from "../theme/assets/preview-bridge.js";
import { createTestEnv } from "./helpers/dom-shim.js";

function loadDefaultDoc() {
  const p = path.resolve(process.cwd(), "theme", "grex.elements.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

test("v0.3 Conditional template specificity, exclude rules, priority tie-breaker, and GREX-TPL-CONFLICT Publish gate", async () => {
  const templates = [
    {
      id: "tpl-entire",
      name: "Entire Site Fallback",
      slot: "single",
      priority: 1,
      conditions: [{ type: "entire_site", value: null, operator: "include" }],
    },
    {
      id: "tpl-type-post",
      name: "Post Type Layout",
      slot: "single",
      priority: 5,
      conditions: [{ type: "content_type", value: "post", operator: "include" }],
    },
    {
      id: "tpl-term-guides",
      name: "Guides Term Layout",
      slot: "single",
      priority: 10,
      conditions: [{ type: "taxonomy_term", value: { taxonomy: "category", term: "guides" }, operator: "include" }],
    },
    {
      id: "tpl-slug-special",
      name: "Special Entry Override",
      slot: "single",
      priority: 20,
      conditions: [{ type: "entry_slug", value: "getting-started-with-grex", operator: "include" }],
    },
  ];

  // 1. entry_slug beats taxonomy_term, content_type, entire_site
  const matchSlug = resolveTemplateForContext(templates, "single", {
    mode: "single",
    entry: { slug: "getting-started-with-grex", content_type: "post", terms: [{ taxonomy: "category", slug: "guides" }] },
  });
  assert.equal(matchSlug.id, "tpl-slug-special");

  // 2. taxonomy_term beats content_type
  const matchTerm = resolveTemplateForContext(templates, "single", {
    mode: "single",
    entry: { slug: "other-post", content_type: "post", terms: [{ taxonomy: "category", slug: "guides" }] },
  });
  assert.equal(matchTerm.id, "tpl-term-guides");

  // 3. exclude operator suppresses matching template
  const withExclude = [
    ...templates.slice(0, 3),
    {
      id: "tpl-term-guides-excl",
      name: "Guides Except Docs",
      slot: "single",
      priority: 5,
      conditions: [
        { type: "taxonomy_term", value: { taxonomy: "category", term: "guides" }, operator: "include" },
        { type: "entry_slug", value: "excluded-post", operator: "exclude" },
      ],
    },
  ];
  const excludedMatch = resolveTemplateForContext(withExclude, "single", {
    mode: "single",
    entry: { slug: "excluded-post", content_type: "post", terms: [{ taxonomy: "category", slug: "guides" }] },
  });
  assert.equal(excludedMatch.id, "tpl-term-guides");

  // 4. Colliding identical conditions + equal priority trigger GREX-TPL-CONFLICT and block Publish
  const collisionSet = [
    {
      id: "tpl-dup-a",
      name: "Dup A",
      slot: "single",
      priority: 10,
      conditions: [{ type: "content_type", value: "post", operator: "include" }],
    },
    {
      id: "tpl-dup-b",
      name: "Dup B",
      slot: "single",
      priority: 10,
      conditions: [{ type: "content_type", value: "post", operator: "include" }],
    },
  ];
  const conflicts = detectTemplateConflicts(collisionSet);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].code, "GREX-TPL-CONFLICT");

  const store = createBuilderStore(loadDefaultDoc());
  store.createTemplate({
    id: "tpl-single-colliding",
    name: "Colliding Single",
    slot: "single",
    priority: 10,
    conditions: [{ type: "all_posts", value: null, operator: "include" }],
  });
  assert.ok(store.templateConflicts.get().some((c) => c.code === "GREX-TPL-CONFLICT"));

  let publishCalled = false;
  const blocked = await store.publish({
    async publish() {
      publishCalled = true;
      return { ok: true };
    },
  });
  assert.equal(blocked.ok, false);
  assert.equal(publishCalled, false);
  assert.match(blocked.error, /GREX-TPL-CONFLICT/);
});

test("v0.3 Dynamic expression resolver preserves exact GrabDecimal/GrabInteger strings and blocks unsafe URLs", () => {
  const ctx = {
    ...DEFAULT_PREVIEW_CONTEXT,
    entry: {
      ...DEFAULT_PREVIEW_CONTEXT.entry,
      title: "Grex <script>alert(1)</script> Edition",
      custom_fields: {
        price: "19.95",
        enterprise_price: "1000.00",
        count: 42,
      },
    },
  };

  assert.equal(resolveDynamicExpression("{{ entry.custom_fields.price }}", ctx), "19.95");
  assert.equal(resolveDynamicExpression("{{ entry.custom_fields.enterprise_price }}", ctx), "1,000.00");
  assert.equal(resolveDynamicExpression("Qty: {{ entry.custom_fields.count }}", ctx), "Qty: 42");
  assert.equal(resolveDynamicExpression("{{ site.title }} — {{ term.name }}", ctx), "Grex Studio Site — Guides & Tutorials");

  assert.throws(
    () =>
      resolveDynamicProps(
        { href: "{{ entry.custom_fields.bad_url }}" },
        { entry: { custom_fields: { bad_url: "javascript:alert(1)" } } }
      ),
    GrexSecurityError
  );
});

test("v0.3 Reversible undo/redo for setTemplateConditions, upsertTemplate, configureQueryLoop, bindDynamicField, bindMediaAsset, bindNavigationMenu", () => {
  const store = createBuilderStore(loadDefaultDoc(), { initialSlot: "home" });

  // 1. upsertTemplate + setTemplateConditions undo/redo
  const beforeTplCount = store.templateRegistry.get().length;
  store.createTemplate({
    id: "tpl-custom-archive",
    name: "Product Guides Archive",
    slot: "archive",
    priority: 15,
    conditions: [{ type: "taxonomy_term", value: { taxonomy: "category", term: "guides" }, operator: "include" }],
  });
  assert.equal(store.templateRegistry.get().length, beforeTplCount + 1);

  store.setTemplateConditions(
    "tpl-custom-archive",
    [{ type: "entry_slug", value: "grex-pro", operator: "include" }],
    30
  );
  let customTpl = store.templateRegistry.get().find((t) => t.id === "tpl-custom-archive");
  assert.equal(customTpl.priority, 30);
  assert.equal(customTpl.conditions[0].type, "entry_slug");

  store.undo();
  customTpl = store.templateRegistry.get().find((t) => t.id === "tpl-custom-archive");
  assert.equal(customTpl.priority, 15);
  assert.equal(customTpl.conditions[0].type, "taxonomy_term");

  store.undo();
  assert.equal(store.templateRegistry.get().length, beforeTplCount);
  store.redo();
  assert.equal(store.templateRegistry.get().length, beforeTplCount + 1);

  // 2. configureQueryLoop + bindDynamicField + bindMediaAsset + bindNavigationMenu
  const homeRootId = store.activeSlotTree.peek().id;
  const loopBox = store.insertElement("Stack", homeRootId);
  const loopBoxId = loopBox.id;
  store.configureQueryLoop(loopBoxId, {
    enabled: true,
    content_type: "post",
    filter_by_term: { taxonomy: "category", slug: "guides" },
    per_page: 2,
    order_dir: "asc",
  });
  assert.equal(store.activeSlotTree.peek().children.find((n) => n.id === loopBoxId).queryLoop.content_type, "post");

  store.undo();
  assert.equal(store.activeSlotTree.peek().children.find((n) => n.id === loopBoxId).queryLoop, undefined);
  store.redo();
  assert.equal(store.activeSlotTree.peek().children.find((n) => n.id === loopBoxId).queryLoop.per_page, 2);

  const loopHeading = store.insertElement("Heading", loopBoxId);
  const loopHeadingId = loopHeading.id;
  store.updateNodeProps(loopHeadingId, { level: 3, text: "Static" });
  store.bindDynamicField(loopHeadingId, "text", "{{ entry.title }}");
  let titleNode = store.activeSlotTree.peek().children.find((n) => n.id === loopBoxId).children[0];
  assert.equal(titleNode.bindings.text, "{{ entry.title }}");
  store.undo();
  titleNode = store.activeSlotTree.peek().children.find((n) => n.id === loopBoxId).children[0];
  assert.equal(titleNode.props.text, "Static");
  assert.equal(titleNode.bindings, undefined);

  // Media Asset + GREX-A11Y-002 enforcement
  const heroImg = store.insertElement("Image", homeRootId);
  const heroImgId = heroImg.id;
  store.updateNodeProps(heroImgId, { src: "/static/theme/preview-hero.svg", alt: "Initial alt" });
  assert.throws(
    () =>
      store.bindMediaAsset(heroImgId, {
        mediaId: "m-bad",
        src: "/static/theme/preview-hero.svg",
        alt: "",
        isDecorative: false,
      }),
    /GREX-A11Y-002/
  );
  store.bindMediaAsset(heroImgId, {
    mediaId: "m-good",
    src: "/static/theme/preview-card.svg",
    alt: "Card token preview",
    width: 800,
    height: 500,
    isDecorative: false,
  });
  let imgNode = store.activeSlotTree.peek().children.find((n) => n.id === heroImgId);
  assert.equal(imgNode.props.alt, "Card token preview");
  assert.equal(imgNode.props.mediaId, "m-good");
  store.undo();
  imgNode = store.activeSlotTree.peek().children.find((n) => n.id === heroImgId);
  assert.equal(imgNode.props.alt, "Initial alt");

  // Decorative image clears alt and sets aria-hidden on Grex JS export; empty non-decorative flagged in diagnostics
  store.bindMediaAsset(heroImgId, {
    mediaId: "m-deco",
    src: "/static/theme/preview-accent.svg",
    alt: "",
    isDecorative: true,
  });
  assert.equal(evaluateSlotDiagnostics(store.activeSlotTree.peek(), extractPartsMap(store.documentTree.peek())).ok, true);

  // Navigation Menu binding undo/redo
  const mainNav = store.insertElement("Nav", homeRootId);
  const mainNavId = mainNav.id;
  store.bindNavigationMenu(mainNavId, "footer", [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ]);
  let navNode = store.activeSlotTree.peek().children.find((n) => n.id === mainNavId);
  assert.equal(navNode.props.location, "footer");
  assert.equal(navNode.props.items.length, 2);
  store.undo();
  navNode = store.activeSlotTree.peek().children.find((n) => n.id === mainNavId);
  assert.equal(navNode.props.location, "primary");
});

test("v0.3 ForEach Query Loop + Nav activePath + Preview As Context Selector in split-screen Studio & Preview DOM (0 divs)", () => {
  const { document, window, body } = createTestEnv();
  const studioRoot = document.createElement("main");
  const previewRoot = document.createElement("section");
  body.appendChild(studioRoot);
  body.appendChild(previewRoot);

  const store = createBuilderStore(loadDefaultDoc(), { initialSlot: "home" });
  const homeRootId = store.activeSlotTree.peek().id;
  const postsGrid = store.insertElement("Grid", homeRootId);
  const postsGridId = postsGrid.id;
  store.configureQueryLoop(postsGridId, {
    enabled: true,
    content_type: "post",
    per_page: 4,
    order_dir: "desc",
  });
  const cardTpl = store.insertElement("Card", postsGridId);
  const cardHeading = store.insertElement("Heading", cardTpl.id);
  store.updateNodeProps(cardHeading.id, { level: 3, text: "{{ entry.title }}" });
  const cardPrice = store.insertElement("Text", cardTpl.id);
  store.updateNodeProps(cardPrice.id, { text: "${{ entry.custom_fields.price }}" });

  const topNav = store.insertElement("Nav", homeRootId);
  store.updateNodeProps(topNav.id, { location: "primary", label: "Primary Navigation" });

  const studio = mountBuilderStudio({
    root: studioRoot,
    document,
    store,
    previewOrigin: "http://127.0.0.1:8080",
  });

  const previewHost = mountPreviewHost({
    allowedOrigins: ["http://127.0.0.1:8080"],
    targetWindow: window,
    root: previewRoot,
    document,
    initialSlots: store.documentTree.peek(),
    initialSlot: "home",
    initialContext: store.previewContext.peek(),
  });

  // Wire postMessage channel from Studio -> PreviewHost
  studio.previewFrame.contentWindow.postMessage = (msg, _origin) => {
    previewHost.handleMessage({ origin: "http://127.0.0.1:8080", data: msg });
  };

  // Query loop renders ForEach <article> items (2 matching 'post' entries, zero <div>)
  const loopEl = previewRoot.querySelector(`[data-grex-id="${postsGridId}"]`);
  assert.ok(loopEl);
  const articles = loopEl.querySelectorAll("article");
  assert.equal(articles.length, 2);
  assert.ok(loopEl.querySelectorAll("p").some((p) => p.textContent === "$19.95"));

  // Nav renders semantic <nav><ul><li><a> with active "/" -> aria-current="page"
  const navEl = previewRoot.querySelector(`[data-grex-id="${topNav.id}"]`);
  assert.ok(navEl);
  const activeNavLinks = navEl
    .querySelectorAll("a")
    .filter((a) => a.getAttribute("aria-current") === "page");
  assert.equal(activeNavLinks.length, 1);
  assert.equal(activeNavLinks[0].getAttribute("href"), "/");

  // Preview Context Selector updates live preview via PreviewBridge
  const modeSelect = studioRoot.querySelector("#grex-preview-mode-select");
  const entrySelect = studioRoot.querySelector("#grex-preview-entry-select");
  assert.ok(modeSelect);
  assert.ok(entrySelect);

  modeSelect.value = "single";
  modeSelect.dispatchEvent({ type: "change", target: modeSelect });
  entrySelect.value = "grex-pro-starter-kit";
  entrySelect.dispatchEvent({ type: "change", target: entrySelect });

  assert.equal(store.previewContext.peek().mode, "single");
  assert.equal(store.previewContext.peek().entry.slug, "grex-pro-starter-kit");

  // Templates panel tab & media dialog open cleanly without any <div> elements
  const templatesTab = studioRoot.querySelector("#grex-tab-templates");
  templatesTab.dispatchEvent({ type: "click" });
  assert.equal(studioRoot.querySelector("#grex-templates-panel").hidden, false);

  store.selectNode(postsGridId);
  assert.ok(studioRoot.querySelector("#grex-query-loop-panel"));

  assert.equal(studioRoot.querySelectorAll("div").length, 0, "Zero <div> allowed in Studio DOM");
  assert.equal(previewRoot.querySelectorAll("div").length, 0, "Zero <div> allowed in Preview DOM");

  previewHost.dispose();
  studio.dispose();
});

test("v0.3 filterPreviewEntries matches GrabLab query_entries pagination & custom field filters", () => {
  const { items, pagination } = filterPreviewEntries(DEFAULT_PREVIEW_CONTEXT.entries, {
    content_type: "post",
    filter_by_term: { taxonomy: "category", slug: "guides" },
    custom_field_filters: [{ key: "price", op: "eq", value: "19.95" }],
    per_page: 5,
    page: 1,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "getting-started-with-grex");
  assert.equal(pagination.total_items, 1);
});
