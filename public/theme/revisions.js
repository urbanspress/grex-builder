/**
 * Grex Theme Builder v0.4 — Immutable Revision Snapshots, Canonical SHA-256 Hashing & Structured Diffs.
 * 100% dependency-free (runs identically in browser ES modules and Node ESM).
 */

import { cloneJson } from "./schema.js";

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8Encode(str) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(String(str));
  }
  const utf8 = unescape(encodeURIComponent(String(str)));
  const out = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i += 1) {
    out[i] = utf8.charCodeAt(i);
  }
  return out;
}

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Pure-JS FIPS 180-4 SHA-256 returning a 64-char lowercase hex digest.
 * @param {string} input
 * @returns {string}
 */
export function sha256HexSync(input) {
  const bytes = utf8Encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;

  const view = new DataView(buf.buffer);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hi, false);
  view.setUint32(paddedLen - 4, lo, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let hex = "";
  for (let i = 0; i < 8; i += 1) {
    hex += H[i].toString(16).padStart(8, "0");
  }
  return hex;
}

/**
 * Recursively normalize any JSON value into a canonical key-sorted JSON string.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalizeJson(item))).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Build a canonical immutable revision snapshot bundle from a GrabLab document or snapshot.
 * Contains `{ templates, parts, conditional_rules, theme_tokens, class_registry }`.
 *
 * @param {object} source
 * @returns {{
 *   templates: Record<string, object>,
 *   parts: Record<string, object>,
 *   conditional_rules: Array<object>,
 *   theme_tokens: object,
 *   class_registry: Record<string, object>
 * }}
 */
export function buildRevisionSnapshot(source) {
  const src = source && typeof source === "object" ? source : {};
  const templates = cloneJson(src.templates || {});
  const parts = cloneJson(src.parts || {});
  const conditionalRules = cloneJson(
    Array.isArray(src.conditional_rules)
      ? src.conditional_rules
      : Array.isArray(src.templateRegistry)
        ? src.templateRegistry
        : []
  );
  const themeTokens = cloneJson(src.theme_tokens || src.theme || {});
  const classRegistry = cloneJson(src.class_registry || src.classes || {});

  return {
    templates,
    parts,
    conditional_rules: conditionalRules,
    theme_tokens: themeTokens,
    class_registry: classRegistry,
  };
}

/**
 * Compute lowercase 64-char SHA-256 content hash over canonical snapshot JSON.
 * @param {object} docOrSnapshot
 * @returns {string}
 */
export function computeSnapshotHash(docOrSnapshot) {
  const canonical = buildRevisionSnapshot(docOrSnapshot);
  return sha256HexSync(canonicalizeJson(canonical));
}

/**
 * Reconstruct a GrabLab CMS `grex.elements.json` document from a revision snapshot.
 * @param {object} snapshot
 * @returns {object}
 */
export function snapshotToDocument(snapshot) {
  const snap = buildRevisionSnapshot(snapshot);
  const doc = {
    schemaVersion: "1.0.0",
    engine: "grex-visual",
    parts: snap.parts,
    templates: snap.templates,
  };
  if (snap.theme_tokens && Object.keys(snap.theme_tokens).length > 0) {
    doc.theme = snap.theme_tokens;
  }
  if (snap.class_registry && Object.keys(snap.class_registry).length > 0) {
    doc.classes = snap.class_registry;
  }
  if (Array.isArray(snap.conditional_rules) && snap.conditional_rules.length > 0) {
    doc.templateRegistry = snap.conditional_rules;
  }
  return doc;
}

function diffKeyedMaps(targetMap, currentMap, prefix = "") {
  const a = targetMap && typeof targetMap === "object" ? targetMap : {};
  const b = currentMap && typeof currentMap === "object" ? currentMap : {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const added = [];
  const modified = [];
  const removed = [];

  for (const k of keys) {
    const label = prefix ? `${prefix}${k}` : k;
    const inTarget = k in a;
    const inCurrent = k in b;
    if (inTarget && !inCurrent) {
      added.push(label);
    } else if (!inTarget && inCurrent) {
      removed.push(label);
    } else if (canonicalizeJson(a[k]) !== canonicalizeJson(b[k])) {
      modified.push(label);
    }
  }
  return { added, modified, removed };
}

/**
 * Compute a structured, human-readable diff comparing `targetSnapshot` (e.g. a historical revision)
 * against `currentSnapshot` (e.g. current live head).
 *
 * @param {object} targetSnapshot
 * @param {object} currentSnapshot
 * @returns {{
 *   templates: { added: string[], modified: string[], removed: string[] },
 *   conditional_rules: { added: string[], modified: string[], removed: string[] },
 *   theme_tokens: { changed: Array<{ mode: string, token: string, from: unknown, to: unknown }> },
 *   class_registry: { added: string[], modified: string[], removed: string[] },
 *   summary: { templatesChanged: number, rulesChanged: number, tokensChanged: number, classesChanged: number, totalChanges: number }
 * }}
 */
export function computeRevisionDiff(targetSnapshot, currentSnapshot) {
  const target = buildRevisionSnapshot(targetSnapshot);
  const current = buildRevisionSnapshot(currentSnapshot);

  const tplDiff = diffKeyedMaps(target.templates, current.templates);
  const partDiff = diffKeyedMaps(target.parts, current.parts, "part:");
  const templates = {
    added: [...tplDiff.added, ...partDiff.added],
    modified: [...tplDiff.modified, ...partDiff.modified],
    removed: [...tplDiff.removed, ...partDiff.removed],
  };

  const targetRulesMap = {};
  for (const r of target.conditional_rules || []) {
    if (r && r.id) targetRulesMap[r.id] = r;
  }
  const currentRulesMap = {};
  for (const r of current.conditional_rules || []) {
    if (r && r.id) currentRulesMap[r.id] = r;
  }
  const conditional_rules = diffKeyedMaps(targetRulesMap, currentRulesMap);

  const tokenChanges = [];
  const checkTokenScope = (mode, tMap, cMap) => {
    const a = tMap && typeof tMap === "object" ? tMap : {};
    const b = cMap && typeof cMap === "object" ? cMap : {};
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    for (const tok of keys) {
      if (a[tok] !== b[tok]) {
        tokenChanges.push({
          mode,
          token: tok,
          from: b[tok] ?? null,
          to: a[tok] ?? null,
        });
      }
    }
  };

  checkTokenScope("base", target.theme_tokens?.tokens, current.theme_tokens?.tokens);
  checkTokenScope("light", target.theme_tokens?.modes?.light, current.theme_tokens?.modes?.light);
  checkTokenScope("dark", target.theme_tokens?.modes?.dark, current.theme_tokens?.modes?.dark);
  if (Boolean(target.theme_tokens?.prefersColorScheme) !== Boolean(current.theme_tokens?.prefersColorScheme)) {
    tokenChanges.push({
      mode: "preferences",
      token: "prefersColorScheme",
      from: Boolean(current.theme_tokens?.prefersColorScheme),
      to: Boolean(target.theme_tokens?.prefersColorScheme),
    });
  }

  const class_registry = diffKeyedMaps(target.class_registry, current.class_registry);

  const templatesChanged = templates.added.length + templates.modified.length + templates.removed.length;
  const rulesChanged =
    conditional_rules.added.length + conditional_rules.modified.length + conditional_rules.removed.length;
  const tokensChanged = tokenChanges.length;
  const classesChanged =
    class_registry.added.length + class_registry.modified.length + class_registry.removed.length;

  return {
    templates,
    conditional_rules,
    theme_tokens: { changed: tokenChanges },
    class_registry,
    summary: {
      templatesChanged,
      rulesChanged,
      tokensChanged,
      classesChanged,
      totalChanges: templatesChanged + rulesChanged + tokensChanged + classesChanged,
    },
  };
}
