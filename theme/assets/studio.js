/**
 * Grex Theme Builder — Split-Screen Studio UI (v0.1).
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
  getNodeId,
  getNodeTag,
} from "./schema.js";
import { findNodeLocation } from "./commands.js";
import { createStudioPreviewClient } from "./preview-bridge.js";

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

  return {
    saveDraft(payload) {
      return postJson("/api/studio/draft", payload);
    },
    publish(payload) {
      return postJson("/api/studio/publish", payload);
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

  const leftAside = doc.createElement("aside");
  leftAside.className = "grex-studio-left";
  leftAside.setAttribute("aria-label", "Palette and Structure");
  leftAside.appendChild(paletteContainer.element);
  leftAside.appendChild(structureNav);

  // --- Center Split-Screen Live Preview Pane ---
  const previewSection = doc.createElement("main");
  previewSection.className = "grex-studio-preview";
  previewSection.setAttribute("aria-label", "Live Visual Preview");

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
      setSafeText(
        a11yBadge.element,
        diag.ok
          ? `WCAG AA: Pass (${diag.warnings.length} warnings)`
          : `WCAG AA: ${diag.errors.length} error(s)`
      );
      a11yBadge.element.className = diag.ok
        ? "grex-studio-a11y-badge is-pass"
        : "grex-studio-a11y-badge is-fail";
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

  disposers.push(
    effect(() => {
      const node = store.selectedNode.get();
      const diag = store.validationReport.get();
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

        const baseStyles = (node.styles && node.styles.base) || {};
        const styleSectionHeading = Heading({ props: { level: 3, text: "Base Styles" } }, { document: doc });
        inspectorAside.appendChild(styleSectionHeading.element);

        for (const [styleProp, label] of [
          ["color", "Text Color"],
          ["background-color", "Background Color"],
          ["padding", "Padding"],
          ["gap", "Gap"],
        ]) {
          if (SUPPORTED_STYLE_PROPS.includes(styleProp)) {
            const styleInput = doc.createElement("input");
            styleInput.type = "text";
            styleInput.value = baseStyles[styleProp] ?? "";
            styleInput.addEventListener("change", (ev) => {
              store.updateNodeStyles(nid, { [styleProp]: ev.target.value });
              previewClient.patchStyle(nid, styleProp, ev.target.value);
            });
            appendLabeledField(inspectorAside, `style-${styleProp}-${nid}`, label, styleInput);
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
      if (diag.issues.length === 0) {
        const li = doc.createElement("li");
        setSafeText(li, "All WCAG AA & Grex schema checks passed.");
        diagList.appendChild(li);
      } else {
        for (const issue of diag.issues) {
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
