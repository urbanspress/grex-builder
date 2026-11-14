/**
 * Grex Theme Builder — Split-Screen Preview Iframe Entrypoint.
 * Boots `mountPreviewHost` with strict same-origin validation (`[window.location.origin]`).
 */

import { mountPreviewHost } from "./preview-bridge.js";

function readInitialJson(selector, fallback) {
  const el = document.querySelector(selector);
  if (!el) {
    return fallback;
  }
  try {
    return JSON.parse(el.getAttribute("content") || el.textContent || "");
  } catch {
    return fallback;
  }
}

export function bootPreviewHost() {
  const root = document.getElementById("grex-preview-root") || document.body;
  const metaSlot = document.querySelector('meta[name="grex-preview-slot"]');
  const initialSlot = metaSlot ? metaSlot.getAttribute("content") || "home" : "home";
  const initialDoc = readInitialJson('meta[name="grex-preview-doc"]', null);

  let initialSlots = null;
  if (initialDoc && typeof initialDoc === "object") {
    initialSlots = { ...(initialDoc.templates || {}) };
    if (initialDoc.parts && typeof initialDoc.parts === "object") {
      for (const [k, v] of Object.entries(initialDoc.parts)) {
        initialSlots[`part:${k}`] = v;
      }
    }
  }

  const host = mountPreviewHost({
    allowedOrigins: [window.location.origin],
    targetWindow: window,
    root,
    document,
    initialSlot,
    initialSlots,
  });

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      { channel: host.channel, type: "preview-ready", slot: initialSlot },
      window.location.origin
    );
  }

  return host;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootPreviewHost());
  } else {
    bootPreviewHost();
  }
}
