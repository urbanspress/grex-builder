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


def main():
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    browser = find_browser()

    guides = [
        ("Grex-Builder-v0.1.0-Guide", build_v010_html()),
        ("Grex-Builder-v0.2.0-Guide", build_v020_html()),
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
