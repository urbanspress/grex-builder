#!/usr/bin/env python3
"""
Generate plain-English HTML and PDF release walkthrough guides for Grex Theme Builder
in `docs/releases/html/` and `docs/releases/pdf/` using headless Chrome/Edge.
"""

import html
import os
import shutil
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
HTML_DIR = ROOT_DIR / "docs" / "releases" / "html"
PDF_DIR = ROOT_DIR / "docs" / "releases" / "pdf"


def find_browser() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chrome"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    raise RuntimeError("Headless Chrome/Edge binary not found for PDF generation.")


CSS = """
  @page { size: letter; margin: 0.65in 0.72in; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    line-height: 1.56;
    font-size: 10.2pt;
    margin: 0;
  }
  .cover {
    border-bottom: 3px solid #1d4ed8;
    padding-bottom: 14pt;
    margin-bottom: 18pt;
  }
  .badge {
    display: inline-block;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    padding: 3pt 10pt;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1 {
    font-size: 22pt;
    line-height: 1.18;
    margin: 10pt 0 6pt 0;
    color: #0f172a;
  }
  .subtitle {
    font-size: 11pt;
    color: #475569;
    margin: 0 0 8pt 0;
  }
  .meta {
    font-size: 9pt;
    color: #64748b;
  }
  h2 {
    font-size: 13.5pt;
    color: #1e3a8a;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4pt;
    margin: 18pt 0 8pt 0;
    break-after: avoid;
  }
  h3 {
    font-size: 11pt;
    color: #0f172a;
    margin: 12pt 0 4pt 0;
    break-after: avoid;
  }
  p { margin: 0 0 8pt 0; }
  ul, ol { margin: 4pt 0 10pt 0; padding-left: 18pt; }
  li { margin-bottom: 4pt; }
  .callout {
    background: #f8fafc;
    border-left: 4px solid #1d4ed8;
    padding: 9pt 12pt;
    margin: 10pt 0 12pt 0;
    border-radius: 0 6pt 6pt 0;
    break-inside: avoid;
  }
  .callout strong { color: #1e3a8a; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0 14pt 0;
    font-size: 9.2pt;
    break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6pt 8pt;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 9pt;
    background: #f1f5f9;
    padding: 1pt 4pt;
    border-radius: 3pt;
    color: #0f172a;
  }
"""


def build_v010_html() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Grex Theme Builder v0.1.0 — Plain-English Walkthrough</title>
  <style>{CSS}</style>
</head>
<body>
  <header class="cover">
    <span class="badge">Release Walkthrough Guide • v0.1.0</span>
    <h1>Grex Theme Builder v0.1.0</h1>
    <p class="subtitle">
      A plain-English guide to Foundation, Studio Shell &amp; Exclusive Visual Mode on GRAB v1.1.0, Grex JS v1.0.0, and GrabLab CMS v1.0.0.
    </p>
    <p class="meta">
      Repository: <code>urbanspress/grex-builder</code> &bull; Release Date: November 14, 2026 &bull; Architecture: Pure GRAB + Grex JS (Zero Vue / Pinia / Webpack / Vite)
    </p>
  </header>

  <section>
    <h2>1. What This Release Delivers (In Plain English)</h2>
    <p>
      <strong>Grex Theme Builder v0.1.0</strong> is the first working release of a visual page and theme editor built
      specifically for GrabLab websites. Unlike traditional website builders that bolt on heavy JavaScript frameworks
      (Vue, React, Pinia, Webpack, Vite) and messy nested <code>&lt;div&gt;</code> boxes, Grex Theme Builder runs
      directly on native <strong>Grex JS v1.0.0</strong> reactive signals, compiles clean HTML5 semantic layouts
      (zero wrapper <code>&lt;div&gt;</code> tags), and plugs straight into <strong>GrabLab CMS v1.0.0</strong> with
      one click.
    </p>
    <aside class="callout">
      <strong>Exclusive Visual Mode Guarantee:</strong> When you activate the <code>grex-builder</code> theme package in
      GrabLab (<code>/admin/themes</code>), GrabLab automatically turns off any previous coded theme and hands 100% of
      page rendering and template control to Grex Theme Builder—cleanly and without theme conflicts.
    </aside>
  </section>

  <section>
    <h2>2. Key Parts Built in v0.1.0</h2>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Where It Lives</th>
          <th>What It Does</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Exclusive Visual Theme Package</strong></td>
          <td><code>theme/theme.json</code>, <code>theme/grex.elements.json</code>, <code>theme/templates/*.grab.html</code></td>
          <td>Declares <code>mode: "visual"</code> and <code>engine: "grex-visual"</code> with 9 semantic zero-<code>&lt;div&gt;</code> template shells (<code>home</code>, <code>single</code>, <code>archive</code>, <code>search</code>, <code>404</code>, plus reusable <code>header</code>, <code>footer</code>, <code>card</code>, and <code>sidebar</code> parts).</td>
        </tr>
        <tr>
          <td><strong>Pure Grex Signal Store</strong></td>
          <td><code>theme/assets/store.js</code> &amp; <code>schema.js</code></td>
          <td>Manages the active template slot, full layout tree, selected block, dirty/saved indicators, compiled CSS tokens, and live <code>validateElementNode()</code> + WCAG AA accessibility checks.</td>
        </tr>
        <tr>
          <td><strong>Shared Undo / Redo Stack</strong></td>
          <td><code>theme/assets/commands.js</code></td>
          <td>Turns every design edit (<code>insertNode</code>, <code>moveNode</code>, <code>deleteNode</code>, <code>updateProps</code>, <code>updateStyles</code>, <code>replaceTree</code>) into a small, replayable JSON step—so both human designers and Groxy AI share undo/redo.</td>
        </tr>
        <tr>
          <td><strong>Split-Screen Studio &amp; Live Bridge</strong></td>
          <td><code>theme/assets/studio.js</code>, <code>preview-bridge.js</code>, <code>preview-host.js</code></td>
          <td>Displays the 20-element palette, keyboard-accessible Structure Tree with drag-and-drop, Inspector, and live iframe synced in browser memory over an origin-locked <code>GrexPreviewBridge</code>.</td>
        </tr>
        <tr>
          <td><strong>Draft Isolation &amp; Verified Publish</strong></td>
          <td><code>src/studio.grab</code> &amp; <code>migrations/001_studio_schema.grab</code></td>
          <td>Stores unfinished edits safely in Draft storage without touching live visitors, then Publish enforces accessibility and security checks, clears the live cache, and writes static CSS to <code>/static/grex/</code>.</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>3. The 20 Built-In Building Blocks</h2>
    <p>
      Every block inserted in the studio comes with clean HTML semantics and WCAG AA accessible defaults:
    </p>
    <ul>
      <li><strong>Layout &amp; Structure (5):</strong> Section (<code>&lt;section&gt;</code>), Container, Grid, Stack, Card (<code>&lt;article&gt;</code>).</li>
      <li><strong>Typography &amp; Media (7):</strong> Heading (<code>&lt;h1&gt;–&lt;h6&gt;</code>), Text, RichText, Link, Button, Image, Icon.</li>
      <li><strong>Forms &amp; Interactive Widgets (8):</strong> Form, Input, Select, Tabs, Accordion, Modal (<code>&lt;dialog&gt;</code>), Nav (<code>&lt;nav&gt;</code>), ForEach Query Loop.</li>
    </ul>
  </section>

  <section>
    <h2>4. Safety, Security &amp; Accessibility Built In</h2>
    <ul>
      <li><strong>Strict Zero-<code>&lt;div&gt;</code> Policy:</strong> Neither the Studio UI, the preview canvas, nor any GrabLab template emits wrapper <code>&lt;div&gt;</code> tags.</li>
      <li><strong>Fail-Closed Cross-Frame Messaging:</strong> <code>GrexPreviewBridge</code> refuses wildcard (<code>*</code>) or untrusted origins and validates message origins strictly.</li>
      <li><strong>Server &amp; Client Security Boundaries:</strong> Raw <code>&lt;script&gt;</code>, <code>&lt;iframe&gt;</code>, <code>on*</code> event handlers, <code>innerHTML</code> sinks, and <code>javascript:</code> / <code>data:</code> URLs are rejected with HTTP 422 before saving or publishing.</li>
      <li><strong>Publish-Time WCAG AA Gate:</strong> Heading hierarchy, accessible button/link labels, alt text on images, form labels, and contrast diagnostics block unsafe publishes automatically.</li>
    </ul>
  </section>

  <section>
    <h2>5. How to Launch &amp; Verify Locally</h2>
    <ol>
      <li>Run migrations for the standalone studio database: <code>grab migrate --db-config grab.data.json --allow-db main:migrate migrations/001_studio_schema.grab</code></li>
      <li>Start the studio server: <code>grab serve --allow-scripts --db-config grab.data.json --allow-db main:read-write --platform-config grab.platform.json --allow-cache studio:read-write --static public --allow-read . --allow-write public/grex src/studio.grab</code></li>
      <li>Open <code>http://127.0.0.1:8080/studio</code> in a modern browser—or install <code>theme/</code> inside GrabLab CMS v1.0.0 under <code>themes/grex-builder</code> and click <strong>Activate</strong> in <code>/admin/themes</code>.</li>
      <li>Run the full automated verification suite anytime with <code>python tests/integration_e2e.py</code>.</li>
    </ol>
  </section>
</body>
</html>
"""


def build_v020_html() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Grex Theme Builder v0.2.0 — Plain-English Release Guide</title>
  <style>{CSS}</style>
</head>
<body>
  <header class="cover">
    <span class="badge">Grex Theme Builder · Release v0.2.0</span>
    <h1>Grex Theme Builder v0.2.0</h1>
    <p class="subtitle">Global Theme Token Studio, Reusable Class Manager &amp; Responsive Breakpoints</p>
    <p class="meta">
      Built on GRAB v1.1.0 · GrabLab CMS v1.0.0 · Grex JS v1.0.0 · Pure Reactive Signals (Zero Vue/Webpack Bloat)
    </p>
  </header>

  <section>
    <h2>1. What&rsquo;s New in Plain English</h2>
    <p>
      <strong>Grex Theme Builder v0.2.0</strong> upgrades the visual studio into a complete, responsive design system.
      Instead of styling one block at a time, you can now manage site-wide brand colors, fonts, spacing, Light &amp; Dark
      themes, reusable CSS classes, and Desktop/Tablet/Mobile layouts—all with live WCAG AA accessibility warnings and
      instant undo/redo.
    </p>
    <div class="callout">
      <strong>Zero-FOUC &amp; 1:1 Parity:</strong> When you click <strong>Publish</strong>, the studio writes the
      compiled <code>tokens.css</code> and <code>builder.css</code> files to <code>/static/grex/</code> <em>before</em>
      promoting the live layout and clearing the cache—so visitors never see an unstyled flash.
    </div>
  </section>

  <section>
    <h2>2. Key v0.2.0 Features</h2>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Where It Lives</th>
          <th>What It Does for Designers</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Global Theme Token Editor</strong></td>
          <td>Left Panel &rarr; <em>Theme Tokens</em> (<code>createTheme</code>)</td>
          <td>Edit brand colors, typography scale, spacing scale, radii, shadows, focus rings, and independent Light/Dark modes.</td>
        </tr>
        <tr>
          <td><strong>Live WCAG AA Contrast Warnings</strong></td>
          <td><code>GREX-A11Y-001</code> in Studio &amp; Inspector</td>
          <td>Automatically checks foreground/background color pairs in Light &amp; Dark modes and warns whenever contrast drops below <code>4.5:1</code>.</td>
        </tr>
        <tr>
          <td><strong>Bricks-Style Reusable Class Manager</strong></td>
          <td>Inspector &rarr; <em>Reusable Classes</em> (<code>createClassManager</code>)</td>
          <td>Create, rename, duplicate, delete, and attach <code>.grex-c-*</code> classes so one edit updates matching elements across every template slot.</td>
        </tr>
        <tr>
          <td><strong>Responsive Breakpoint Switcher</strong></td>
          <td>Top Toolbar (<code>Desktop &ge; 1025px</code>, <code>Tablet &le; 1024px</code>, <code>Mobile &le; 767px</code>)</td>
          <td>Resizes the live preview canvas and compiles deterministic media-query rules into <code>/static/grex/builder.css</code>.</td>
        </tr>
        <tr>
          <td><strong>Structured Visual Inspector</strong></td>
          <td>Box Model, Layout, Typography, Border &amp; Background</td>
          <td>Every style edit runs as a reversible command (<code>setThemeToken</code>, <code>upsertClass</code>, <code>assignClass</code>, <code>setBreakpointStyle</code>) with full undo/redo.</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>3. Verification &amp; Quality Gates</h2>
    <ul>
      <li><strong>Zero Wrapper <code>&lt;div&gt;</code> Bloat:</strong> Verified across all studio panels, preview DOM, and GrabLab <code>.grab.html</code> templates.</li>
      <li><strong>GRAB v1.1.0 Static &amp; Format Checks:</strong> All <code>.grab</code> and <code>.grab.html</code> files pass <code>grab check</code> and canonical <code>grab format</code>.</li>
      <li><strong>Automated Test Suite:</strong> 10/10 Node unit/DOM/a11y/bridge tests and all 5 end-to-end GrabLab CMS integration gates pass at 100%.</li>
    </ul>
  </section>
</body>
</html>
"""


def build_v030_html() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Grex Theme Builder v0.3.0 — Plain-English Release Guide</title>
  <style>{CSS}</style>
</head>
<body>
  <header class="cover">
    <span class="badge">Grex Theme Builder · Release v0.3.0</span>
    <h1>Grex Theme Builder v0.3.0</h1>
    <p class="subtitle">Conditional Theme Builder, Visual Query Loop Builder, Dynamic/Media/Menu Pickers &amp; Live Preview Context Selector</p>
    <p class="meta">
      Built on GRAB v1.1.0 · GrabLab CMS v1.0.0 · Grex JS v1.0.0 · Exclusive mode: &quot;visual&quot;
    </p>
  </header>

  <section class="callout">
    <strong>Plain-English Overview:</strong> Grex Theme Builder v0.3.0 elevates the visual studio into a complete conditional theme and query builder. Designers can assign distinct templates by content type, taxonomy term, or slug with automatic conflict detection, loop live GrabLab CMS entries with zero wrapper <code>&lt;div&gt;</code> elements, bind dynamic fields (keeping exact decimal prices), choose accessible media and navigation menus, and switch live preview contexts directly in the toolbar.
  </section>

  <section>
    <h2>1. What Changed in v0.3.0</h2>
    <ul>
      <li><strong>Conditional Theme Builder &amp; Conflict Detection (<code>GREX-TPL-CONFLICT</code>):</strong> Manage multiple named templates across <code>header</code>, <code>footer</code>, <code>home</code>, <code>single</code>, <code>archive</code>, <code>search</code>, and <code>404</code> plus reusable global parts (<code>card</code>, <code>hero</code>, <code>cta</code>, <code>sidebar</code>). Rules resolve deterministically (<code>entry_slug &gt; taxonomy_term &gt; content_type &gt; all_posts / front_page &gt; entire_site</code>), support <code>exclude</code> overrides, and block publishing whenever colliding conditions share equal priority.</li>
      <li><strong>Visual Query Loop Builder (<code>ForEach</code> + GrabLab Query Feeds):</strong> Bind <code>Grid</code>, <code>Stack</code>, <code>Section</code>, or <code>ForEach</code> containers to GrabLab <code>query_entries</code> feeds filtered by content type, taxonomy term, custom fields, sorting, and pagination with clean <code>&lt;article&gt;</code> output and zero wrapper <code>&lt;div&gt;</code> bloat.</li>
      <li><strong>Dynamic Data Picker (Exact <code>GrabDecimal</code> / <code>GrabInteger</code> Precision):</strong> Bind text, headings, links, buttons, and images to <code>entry.*</code>, <code>entry.custom_fields.*</code>, <code>term.*</code>, and <code>site.*</code> via XSS-safe <code>textContent</code> and URL-protocol sanitization while keeping financial decimals such as <code>&quot;19.95&quot;</code> and <code>&quot;1,000.00&quot;</code> exact.</li>
      <li><strong>Media Library &amp; Navigation Menu Pickers:</strong> Select assets from <code>/api/media</code> inside an accessible modal <code>&lt;dialog&gt;</code> enforcing WCAG AA <code>alt</code> text or explicit decorative toggle (<code>GREX-A11Y-002</code>), and bind <code>Nav</code> elements to <code>/api/menus/&#123;location&#125;</code> with semantic <code>&lt;nav&gt;&lt;ul&gt;&lt;li&gt;&lt;a aria-current=&quot;page&quot;&gt;</code> rendering.</li>
      <li><strong>Live Preview Context Selector (<em>Preview As</em>):</strong> Switch between Front Page, Specific Entry, Specific Term Archive, Search Results, and 404 Page in the studio toolbar to preview dynamic bindings and Query Loops live via <code>GrexPreviewBridge</code> while editing.</li>
      <li><strong>Deterministic Undo/Redo Command Stack:</strong> All new v0.3.0 actions (<code>setTemplateConditions</code>, <code>upsertTemplate</code>, <code>configureQueryLoop</code>, <code>bindDynamicField</code>, <code>bindMediaAsset</code>, <code>bindNavigationMenu</code>) execute as reversible commands shared with Groxy AI (<code>grab mcp</code>).</li>
    </ul>
  </section>

  <section>
    <h2>2. New Studio Controls &amp; API Surface</h2>
    <table>
      <thead>
        <tr>
          <th>Surface</th>
          <th>Purpose</th>
          <th>Safety / Accessibility Guardrail</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Toolbar: <strong>Preview As</strong></td>
          <td>Selects active route mode, sample entry, or term archive live inside <code>GrexPreviewBridge</code></td>
          <td>Explicit allowed-origin frame check; XSS-free DOM updates</td>
        </tr>
        <tr>
          <td>Left Tab: <strong>Templates</strong></td>
          <td>Create conditional templates, set rules/priorities, inspect resolved match</td>
          <td><code>GREX-TPL-CONFLICT</code> collision warning blocks unsafe Publish</td>
        </tr>
        <tr>
          <td>Inspector: <strong>Query Loop &amp; Pickers</strong></td>
          <td>Configure <code>ForEach</code> loop filters, bind <code>&#123;&#123; ... &#125;&#125;</code> tokens, pick media &amp; nav menus</td>
          <td><code>GREX-A11Y-002</code> requires <code>alt</code> or decorative flag; safe URLs only</td>
        </tr>
        <tr>
          <td>Studio Server Routes</td>
          <td>Standalone <code>/api/query</code>, <code>/api/media</code>, <code>/api/menus/&#123;location&#125;</code>, <code>/api/preview/context</code></td>
          <td>Zero wrapper <code>&lt;div&gt;</code> validation on every saved/published doc</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>3. Verification &amp; Quality Gates</h2>
    <ul>
      <li><strong>Zero Wrapper <code>&lt;div&gt;</code> Bloat:</strong> Verified across every Studio panel, <code>ForEach</code> Query Loop output, Navigation Menu markup, Media dialog, and all 11 <code>.grab.html</code> templates.</li>
      <li><strong>GRAB v1.1.0 Static &amp; Format Checks:</strong> All <code>.grab</code> and <code>.grab.html</code> files pass <code>grab check</code> and canonical <code>grab format</code>.</li>
      <li><strong>Automated Test Suite:</strong> 15/15 Node unit, DOM, accessibility, command stack, and preview bridge tests plus all 5 GrabLab CMS v1.0.0 integration E2E gates pass at 100%.</li>
    </ul>
  </section>
</body>
</html>
"""


def build_v040_html() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Grex Theme Builder v0.4.0 — Plain-English Release Guide</title>
  <style>{CSS}</style>
</head>
<body>
  <header class="cover">
    <span class="badge">Grex Theme Builder · Release v0.4.0</span>
    <h1>Grex Theme Builder v0.4.0</h1>
    <p class="subtitle">Immutable Publish Revisions, One-Click Rollback &amp; Live <code>GRAB-DESIGN-SYSTEM.md</code> / <code>grab mcp</code> AI Guardrails</p>
    <p class="meta">
      Built on GRAB v1.1.0 · GrabLab CMS v1.0.0 · Grex JS v1.0.0 · Exclusive mode: &quot;visual&quot;
    </p>
  </header>

  <section class="callout">
    <strong>Plain-English Overview:</strong> Grex Theme Builder v0.4.0 brings fearless publishing and safe AI co-design to the studio. Every Publish permanently records an immutable revision snapshot with deduplication, lets designers preview any past state side-by-side before restoring it with one click (CSS-first for zero flash of unstyled content), keeps a live <code>GRAB-DESIGN-SYSTEM.md</code> contract in sync with active tokens and classes, and enforces WCAG AA + structural guardrails on every incoming <code>grab mcp</code> / Groxy AI layout mutation.
  </section>

  <section>
    <h2>1. What Changed in v0.4.0</h2>
    <ul>
      <li><strong>Immutable Publish Snapshots (<code>template_revisions</code>):</strong> Migration <code>migrations/002_revisions_schema.grab</code> introduces the append-only <code>template_revisions</code> table storing complete point-in-time snapshots (templates, parts, conditional display rules, <code>--grex-*</code> theme tokens, and <code>.grex-c-*</code> classes), author metadata, summary, timestamp, and canonical SHA-256 hash with automatic duplicate suppression when nothing changed since the previous revision.</li>
      <li><strong>Semantic Revisions &amp; Diff Drawer + Safe Live Preview:</strong> A new zero-wrapper-<code>&lt;div&gt;</code> <strong>Revisions</strong> drawer in the top toolbar displays the revision timeline, structured human-readable diffs across templates, conditional rules, theme tokens, and reusable classes, and a <em>Preview This Revision</em> button that renders any past revision live inside <code>GrexPreviewBridge</code> without affecting public visitors or draft state.</li>
      <li><strong>One-Click Zero-FOUC Rollback (<code>POST /api/revisions/&#123;id&#125;/restore</code>):</strong> Restoring a historical revision via the accessible confirmation <code>&lt;dialog&gt;</code> compiles and writes <code>tokens.css</code> and <code>builder.css</code> to <code>/static/grex/</code> <em>before</em> updating <code>studio_layouts</code> and bumping the <code>use cache</code> epoch, regenerates <code>GRAB-DESIGN-SYSTEM.md</code>, and appends a new forward revision (e.g., <em>Restored from Revision #N</em>) so prior history is never lost.</li>
      <li><strong>Auto-Generated <code>GRAB-DESIGN-SYSTEM.md</code> Contract (<code>GET /api/design-system.md</code>):</strong> Every Publish and Restore automatically regenerates <code>GRAB-DESIGN-SYSTEM.md</code> containing active <code>--grex-*</code> tokens, reusable <code>.grex-c-*</code> class rules, approved 20-element semantic patterns, and conditional template rules so Groxy AI and <code>grab mcp</code> clients stay aligned with your design system.</li>
      <li><strong><code>grab mcp</code> AI Layout Guardrails &amp; 1-Click Undo (<code>POST /api/mcp/layout</code>, <code>applyAiLayout</code>):</strong> All incoming AI layout changes are strictly validated against <code>validateElementNode()</code> and WCAG AA <code>auditAccessibility()</code> (rejecting forbidden <code>&lt;div&gt;</code> wrappers, <code>&lt;script&gt;</code> / <code>javascript:</code> vectors, depth &gt; 24, contrast &lt; 4.5:1, and missing <code>Image</code> <code>alt</code> text with HTTP <code>422</code> / JSON-RPC <code>-32602</code> before touching state). Valid AI edits commit to draft cleanly with <code>actor: &quot;groxy-ai&quot;</code>, surface a notice badge in the studio, and support instant <code>Ctrl+Z</code> / toolbar <strong>Undo</strong> rollback.</li>
    </ul>
  </section>

  <section>
    <h2>2. New Studio Controls &amp; API Surface</h2>
    <table>
      <thead>
        <tr>
          <th>Surface</th>
          <th>Purpose</th>
          <th>Safety / Accessibility Guardrail</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Toolbar: <strong>Revisions</strong> + Timeline Drawer</td>
          <td>Inspect snapshot hashes, structured diffs, and historical preview</td>
          <td>Zero <code>&lt;div&gt;</code> semantic <code>&lt;aside&gt;</code> + origin-verified <code>GrexPreviewBridge</code></td>
        </tr>
        <tr>
          <td>Modal <code>&lt;dialog&gt;</code>: <strong>Restore This Revision</strong></td>
          <td>Executes one-click rollback and appends forward audit revision</td>
          <td>CSS written to <code>/static/grex/</code> first for zero FOUC; CSRF required</td>
        </tr>
        <tr>
          <td><code>GET /api/design-system.md</code> &amp; <code>storage/GRAB-DESIGN-SYSTEM.md</code></td>
          <td>Publishes live design tokens, classes, element patterns &amp; conditional rules</td>
          <td>Auto-updated on every Publish and Restore</td>
        </tr>
        <tr>
          <td><code>POST /api/mcp/layout</code> &amp; <code>GET /api/studio/commands</code></td>
          <td>Applies AI-authored layouts with reversible undo log (<code>actor: &quot;groxy-ai&quot;</code>)</td>
          <td>Fail-closed <code>422</code> / <code>-32602</code> rejection on schema, XSS, or WCAG AA failure</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>3. Verification &amp; Quality Gates</h2>
    <ul>
      <li><strong>Zero Wrapper <code>&lt;div&gt;</code> Bloat:</strong> Verified across the Revisions Drawer, confirmation dialog, AI actor notice, <code>GrexPreviewBridge</code> preview frames, and all 11 <code>.grab.html</code> templates.</li>
      <li><strong>GRAB v1.1.0 Static &amp; Format Checks:</strong> <code>src/studio.grab</code>, <code>migrations/001_studio_schema.grab</code>, <code>migrations/002_revisions_schema.grab</code>, and all 11 <code>.grab.html</code> files pass <code>grab check</code> and byte-for-byte canonical <code>grab format</code>.</li>
      <li><strong>Automated Test Suite:</strong> 20/20 Node unit, DOM, accessibility, command stack, revision diff, and AI guardrail tests plus all 5 live Grisp &amp; GrabLab CMS v1.0.0 integration gates pass at 100%.</li>
    </ul>
  </section>
</body>
</html>
"""


def main():
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    browser = find_browser()

    guides = [
        ("Grex-Builder-v0.1.0-Guide", build_v010_html()),
        ("Grex-Builder-v0.2.0-Guide", build_v020_html()),
        ("Grex-Builder-v0.3.0-Guide", build_v030_html()),
        ("Grex-Builder-v0.4.0-Guide", build_v040_html()),
    ]
    for stem, content in guides:
        html_path = HTML_DIR / f"{stem}.html"
        pdf_path = PDF_DIR / f"{stem}.pdf"
        html_path.write_text(content, encoding="utf-8")
        subprocess.run(
            [
                browser,
                "--headless",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={str(pdf_path.resolve())}",
                html_path.resolve().as_uri(),
            ],
            check=True,
        )
        assert pdf_path.is_file() and pdf_path.stat().st_size > 10_000, f"PDF output invalid: {pdf_path}"
        print(f"Generated HTML: {html_path}")
        print(f"Generated PDF:  {pdf_path} ({pdf_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
