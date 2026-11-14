#!/usr/bin/env python3
"""
End-to-end verification suite for Grex Theme Builder v0.1.0:
  1. GRAB static checks (`grab check` + canonical `grab format` byte match)
  2. `.grab.html` template compilation (`grab check` probe) and zero wrapper `<div>` verification
  3. Node unit, DOM, accessibility, command stack, and GrexPreviewBridge origin-rejection tests
  4. Live `src/studio.grab` server E2E test (Draft isolation, CSRF, security gate, Publish cache epoch + `/static/grex/` CSS output)
  5. Live `GrabLab CMS v1.0.0` exclusive `mode: "visual"` theme activation, rendering, and `grab mcp` layout sync test
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
GRAB_BIN = Path(os.environ.get("GRAB_BIN", r"C:\Development\GRAB\dist\grab-windows-amd64.exe"))
GRABLAB_DIR = Path(os.environ.get("GRABLAB_DIR", r"C:\Development\grablab-cms"))


def run_cmd(args, cwd=None, env=None, check=True):
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    res = subprocess.run(
        [str(a) for a in args],
        cwd=str(cwd or ROOT_DIR),
        env=merged_env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and res.returncode != 0:
        raise AssertionError(
            f"Command failed ({res.returncode}): {' '.join(map(str, args))}\n"
            f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
        )
    return res


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http_req(port, method, path, body=None, headers=None, cookies=None):
    url = f"http://127.0.0.1:{port}{path}"
    hdrs = dict(headers or {})
    if cookies:
        hdrs["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/json")
        elif isinstance(body, str):
            data = body.encode("utf-8")
        else:
            data = body
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            set_cookies = resp.headers.get_all("Set-Cookie") or []
            parsed = None
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = None
            return resp.status, dict(resp.headers), set_cookies, raw, parsed
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        parsed = None
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = None
        return err.code, dict(err.headers), err.headers.get_all("Set-Cookie") or [], raw, parsed


def parse_cookies(set_cookie_headers, jar):
    for h in set_cookie_headers:
        first = h.split(";", 1)[0]
        if "=" in first:
            k, v = first.split("=", 1)
            jar[k.strip()] = v.strip()


def wait_for_health(port, path="/_health", proc=None, timeout=15.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc is not None and proc.poll() is not None:
            out, err = proc.communicate()
            raise AssertionError(f"Server exited early ({proc.returncode}):\nSTDOUT:\n{out}\nSTDERR:\n{err}")
        try:
            st, _, _, _, data = http_req(port, "GET", path)
            if st == 200:
                return data
        except Exception:
            pass
        time.sleep(0.15)
    raise AssertionError(f"Timed out waiting for http://127.0.0.1:{port}{path}")


def test_grab_static_checks():
    print("[1/5] Checking .grab files (`grab check` + canonical `grab format`)...")
    assert GRAB_BIN.exists(), f"Missing GRAB binary at {GRAB_BIN}"

    run_cmd([GRAB_BIN, "check", "--db-config", "grab.data.json", "migrations/001_studio_schema.grab"])
    run_cmd([GRAB_BIN, "check", "--platform-config", "grab.platform.json", "src/studio.grab"])

    for rel in ["migrations/001_studio_schema.grab", "src/studio.grab"]:
        p = ROOT_DIR / rel
        before = p.read_text(encoding="utf-8")
        run_cmd([GRAB_BIN, "format", "--write", rel])
        after = p.read_text(encoding="utf-8")
        assert before == after, f"{rel} was not canonically formatted before check."


def test_grab_html_templates():
    print("[2/5] Checking all 11 .grab.html templates (`grab check` probe + zero <div>)...")
    templates = sorted((ROOT_DIR / "theme" / "templates").rglob("*.grab.html")) + sorted(
        (ROOT_DIR / "views").glob("*.grab.html")
    )
    assert len(templates) == 11, f"Expected 11 .grab.html files, got {len(templates)}"

    sample_vars = {
        "site_title": "Grex Theme Builder",
        "tagline": "Visual Theme",
        "site_description": "Pure GRAB + Grex JS",
        "page_title": "Home",
        "title": "Sample Post",
        "excerpt": "Summary",
        "body_html": "<p>Body</p>",
        "published_at": "2026-11-14",
        "archive_label": "Posts",
        "query": "hello",
        "search_query": "hello",
        "theme_slug": "grex-builder",
        "theme_version": "0.1.0",
        "theme_css_url": "/static/theme/theme.css",
        "tokens_css_url": "/static/grex/tokens.css",
        "builder_css_url": "/static/grex/builder.css",
        "studio_js_url": "/static/theme/studio.js",
        "preview_host_js_url": "/static/theme/preview-host.js",
        "head_meta_html": "",
        "header_menu_html": "<a href='/'>Home</a>",
        "footer_menu_html": "<a href='/about'>About</a>",
        "theme_footer_html": "",
        "entries_html": "<article><p>Entry</p></article>",
        "recent_entries_html": "<a href='/post'>Post</a>",
        "categories_html": "<a href='/category/news'>News</a>",
        "csrf_token": "tok",
        "doc_json": "{}",
        "slot_name": "home",
        "slug": "sample-post",
        "summary": "Summary text",
    }

    with tempfile.TemporaryDirectory(prefix="grex-tpl-check-") as td:
        probe_path = Path(td) / "probe.grab"
        copied_tpl = Path(td) / "tpl.grab.html"
        for tpl in templates:
            raw = tpl.read_text(encoding="utf-8")
            assert "<div" not in raw.lower(), f"Forbidden <div> wrapper found in {tpl}"
            copied_tpl.write_text(raw, encoding="utf-8")

            pairs = ", ".join(f'{k}: "{v}"' for k, v in sample_vars.items())
            probe_src = (
                "use server\n"
                'route "GET" "/"\n'
                f'  give back server.html using "tpl.grab.html", record {{{pairs}}}\n'
                "end\n"
            )
            probe_path.write_text(probe_src, encoding="utf-8")
            run_cmd([GRAB_BIN, "check", probe_path], cwd=td)


def test_node_unit_and_dom_suite():
    print("[3/5] Running Node unit, DOM, accessibility, command stack & bridge tests...")
    res = run_cmd([
        "node",
        "--test",
        "tests/unit_store_commands.test.js",
        "tests/dom_studio_bridge.test.js",
        "tests/unit_v03_conditional_dynamic.test.js",
    ])
    assert "fail 0" in res.stdout or res.returncode == 0, res.stdout


def test_live_studio_server():
    print("[4/5] Running live `src/studio.grab` server E2E test (Draft isolation, CSRF, security gate, Publish)...")
    with tempfile.TemporaryDirectory(prefix="grex-studio-live-") as td:
        tmp = Path(td)
        # Copy minimal studio runtime into temp directory so DB & published CSS never touch working tree
        for d in ["src", "migrations", "views", "theme", "public"]:
            shutil.copytree(ROOT_DIR / d, tmp / d)
        (tmp / "storage").mkdir(parents=True, exist_ok=True)

        db_rel = "storage/studio.db"
        data_cfg = {
            "connections": {"main": {"driver": "sqlite", "path": db_rel}},
        }
        (tmp / "grab.data.json").write_text(json.dumps(data_cfg, indent=2), encoding="utf-8")
        shutil.copy2(ROOT_DIR / "grab.platform.json", tmp / "grab.platform.json")

        static_grex = tmp / "public" / "grex"

        run_cmd(
            [
                GRAB_BIN,
                "migrate",
                "--db-config",
                "grab.data.json",
                "--allow-db",
                "main:migrate",
                "migrations/001_studio_schema.grab",
            ],
            cwd=tmp,
        )

        port = free_port()
        env = os.environ.copy()
        env["GREX_STATIC_DIR"] = str(static_grex).replace("\\", "/")

        studio_out = (tmp / "studio.stdout.log").open("w+", encoding="utf-8", errors="replace")
        studio_err = (tmp / "studio.stderr.log").open("w+", encoding="utf-8", errors="replace")
        proc = subprocess.Popen(
            [
                str(GRAB_BIN),
                "serve",
                "--addr",
                f"127.0.0.1:{port}",
                "--allow-scripts",
                "--db-config",
                "grab.data.json",
                "--allow-db",
                "main:read-write",
                "--platform-config",
                "grab.platform.json",
                "--allow-cache",
                "studio:read-write",
                "--static",
                "public",
                "--allow-read",
                str(tmp),
                "--allow-write",
                str(static_grex),
                "--allow-env",
                "GREX_STATIC_DIR",
                "src/studio.grab",
            ],
            cwd=str(tmp),
            env=env,
            stdout=studio_out,
            stderr=studio_err,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        try:
            health = wait_for_health(port, "/_health", proc=proc)
            assert health.get("status") == "ok", health

            # Verify public/theme/* stays in sync with theme/assets/*
            for asset_src in (ROOT_DIR / "theme" / "assets").iterdir():
                if asset_src.is_file():
                    served_copy = ROOT_DIR / "public" / "theme" / asset_src.name
                    assert served_copy.exists() and served_copy.read_bytes() == asset_src.read_bytes(), (
                        f"Asset parity mismatch for {asset_src.name}"
                    )

            # Verify Studio & Preview & static module assets serve cleanly with zero <div>
            st, _, _, studio_html, _ = http_req(port, "GET", "/studio")
            assert st == 200 and "<div" not in studio_html.lower() and "grex-studio-root" in studio_html, (
                f"/studio failed ({st}): {studio_html[:400]}"
            )
            st, _, _, preview_html, _ = http_req(port, "GET", "/preview/home?mode=draft")
            assert st == 200 and "<div" not in preview_html.lower() and "grex-preview-root" in preview_html
            for asset_path in [
                "/static/grex/grex.js",
                "/static/grex/tokens.css",
                "/static/grex/builder.css",
                "/static/theme/studio.js",
                "/static/theme/preview-host.js",
                "/static/theme/theme.css",
            ]:
                st, _, _, _, _ = http_req(port, "GET", asset_path)
                assert st == 200, f"Expected 200 on {asset_path}, got {st}"

            st, _, _, _, st0 = http_req(port, "GET", "/api/studio/state")
            assert st == 200
            csrf = st0["csrf_token"]
            epoch0 = st0["live_epoch"]

            # Warm live cache check
            st, _, _, _, st1 = http_req(port, "GET", "/api/studio/state")
            assert st == 200 and st1["live_cache_hit"] is True

            # Missing CSRF -> 403
            st, _, _, _, _ = http_req(port, "POST", "/api/studio/draft", {"document": st0["draft"]})
            assert st == 403, f"Expected 403 without CSRF, got {st}"

            # Unsafe <div> element -> 422
            bad_doc = json.loads(json.dumps(st0["draft"]))
            bad_doc["templates"]["home"]["children"].append({"element": "Text", "tag": "div", "props": {"text": "Bad"}})
            st, _, _, _, bad_res = http_req(
                port, "POST", "/api/studio/draft", {"document": bad_doc}, headers={"X-CSRF-Token": csrf}
            )
            assert st == 422 and bad_res["ok"] is False, bad_res

            # Save Draft with v0.2 theme tokens + reusable classes -> draft updates, published remains untouched
            draft_doc = json.loads(json.dumps(st0["draft"]))
            draft_doc["templates"]["home"]["children"][1]["children"][0]["children"][1]["props"]["text"] = (
                "Draft Hero Headline"
            )
            draft_doc["theme"] = {
                "tokens": {"--grex-color-primary": "#047857"},
                "modes": {"light": {"--grex-color-bg": "#f8fafc"}, "dark": {"--grex-color-bg": "#0f172a"}},
                "prefersColorScheme": False,
            }
            draft_doc["classes"] = {
                "hero-card": {
                    "base": {"padding": "2rem"},
                    "tablet": {"padding": "1.5rem"},
                    "mobile": {"padding": "1rem"},
                }
            }
            draft_doc["templateRegistry"] = [
                {
                    "id": "tpl-guides-archive",
                    "name": "Guides Term Archive",
                    "slot": "archive",
                    "priority": 25,
                    "conditions": [{"type": "taxonomy_term", "value": "guides", "operator": "include"}],
                }
            ]
            st, _, _, _, dr_res = http_req(
                port, "POST", "/api/studio/draft", {"document": draft_doc}, headers={"X-CSRF-Token": csrf}
            )
            assert st == 200 and dr_res["ok"] is True

            # Verify v0.3 standalone /api/query, /api/media, /api/menus/*, and /api/preview/context
            st, _, _, _, q_res = http_req(port, "GET", "/api/query?content_type=post&term=guides")
            assert st == 200 and q_res["ok"] is True and len(q_res["items"]) == 1, q_res
            assert q_res["items"][0]["custom_fields"]["price"] == "19.95", q_res

            st, _, _, _, m_res = http_req(port, "GET", "/api/media")
            assert st == 200 and m_res["ok"] is True and m_res["total"] >= 2, m_res

            st, _, _, _, nav_res = http_req(port, "GET", "/api/menus/primary")
            assert st == 200 and nav_res["ok"] is True and len(nav_res["menu"]) >= 3, nav_res
            st, _, _, _, bad_nav = http_req(port, "GET", "/api/menus/nonexistent")
            assert st == 404 and bad_nav["ok"] is False, bad_nav

            st, _, _, _, ctx_res = http_req(port, "GET", "/api/preview/context")
            assert st == 200 and ctx_res["ok"] is True and len(ctx_res["entries"]) >= 3, ctx_res
            assert any(e["custom_fields"]["price"] == "1000.00" for e in ctx_res["entries"]), ctx_res

            st, _, _, _, st2 = http_req(port, "GET", "/api/studio/state")
            assert (
                st2["draft"]["templates"]["home"]["children"][1]["children"][0]["children"][1]["props"]["text"]
                == "Draft Hero Headline"
            )
            assert st2["draft"]["classes"]["hero-card"]["mobile"]["padding"] == "1rem"
            assert (
                st2["published"]["templates"]["home"]["children"][1]["children"][0]["children"][1]["props"]["text"]
                == "{site_title}"
            )
            assert st2["live_epoch"] == epoch0

            # Publish -> updates published, bumps live_epoch (invalidating use cache), writes /static/grex/*.css
            marker_css = (
                "/* published-e2e-marker */\n"
                ".grex-c-hero-card { padding: 2rem; }\n"
                "@media (max-width: 1024px) { .grex-c-hero-card { padding: 1.5rem; } }\n"
                "@media (max-width: 767px) { .grex-c-hero-card { padding: 1rem; } }\n"
            )
            tokens_css = (
                ":root { --grex-color-primary: #047857; }\n"
                "[data-grex-theme=\"dark\"] { --grex-color-bg: #0f172a; }\n"
            )
            st, _, _, _, pub_res = http_req(
                port,
                "POST",
                "/api/studio/publish",
                {"document": draft_doc, "tokensCss": tokens_css, "builderCss": marker_css},
                headers={"X-CSRF-Token": csrf},
            )
            assert st == 200 and pub_res["ok"] is True, pub_res
            assert pub_res["live_epoch"] == epoch0 + 1

            st, _, _, _, st3 = http_req(port, "GET", "/api/studio/state")
            assert (
                st3["published"]["templates"]["home"]["children"][1]["children"][0]["children"][1]["props"]["text"]
                == "Draft Hero Headline"
            )
            assert st3["published"]["classes"]["hero-card"]["tablet"]["padding"] == "1.5rem"
            assert st3["published"]["templateRegistry"][0]["id"] == "tpl-guides-archive"
            assert st3["live_epoch"] == epoch0 + 1

            st, _, _, served_builder_css, _ = http_req(port, "GET", "/static/grex/builder.css")
            assert st == 200 and "published-e2e-marker" in served_builder_css
            assert "@media (max-width: 1024px)" in served_builder_css
            assert "@media (max-width: 767px)" in served_builder_css
            assert (static_grex / "tokens.css").read_text(encoding="utf-8") == tokens_css
        finally:
            proc.terminate()
            proc.wait(timeout=5)
            studio_out.close()
            studio_err.close()


def test_grablab_cms_visual_theme_integration():
    print("[5/5] Testing GrabLab CMS v1.0.0 exclusive mode:visual activation + zero-<div> rendering + grab mcp...")
    assert GRABLAB_DIR.exists(), f"Missing GrabLab CMS directory at {GRABLAB_DIR}"

    with tempfile.TemporaryDirectory(prefix="grex-grablab-e2e-") as td:
        cms = Path(td) / "cms"
        cms.mkdir(parents=True, exist_ok=True)
        for sub in ["src", "migrations", "public", "themes"]:
            shutil.copytree(GRABLAB_DIR / sub, cms / sub)
        (cms / "storage").mkdir(parents=True, exist_ok=True)
        for fname in ["grab.platform.json"]:
            if (GRABLAB_DIR / fname).exists():
                shutil.copy2(GRABLAB_DIR / fname, cms / fname)

        data_cfg = {
            "connections": {"main": {"driver": "sqlite", "path": "storage/grablab.db"}},
        }
        (cms / "grab.data.json").write_text(json.dumps(data_cfg, indent=2), encoding="utf-8")

        # Install Grex Theme Builder package as `themes/grex-builder`
        shutil.copytree(ROOT_DIR / "theme", cms / "themes" / "grex-builder")
        (cms / "public" / "themes" / "grex-builder").mkdir(parents=True, exist_ok=True)
        shutil.copy2(
            ROOT_DIR / "theme" / "assets" / "theme.css",
            cms / "public" / "themes" / "grex-builder" / "theme.css",
        )

        for mig_name in ["001_schema.grab", "002_auth_schema.grab", "003_v04_schema.grab"]:
            mig = cms / "migrations" / mig_name
            if not mig.exists():
                continue
            run_cmd(
                [
                    GRAB_BIN,
                    "migrate",
                    "--db-config",
                    "grab.data.json",
                    "--allow-db",
                    "main:migrate",
                    f"migrations/{mig_name}",
                ],
                cwd=cms,
            )
        run_cmd(
            [
                GRAB_BIN,
                "run",
                "--db-config",
                "grab.data.json",
                "--allow-db",
                "main:read-write",
                "--allow-read",
                ".",
                "migrations/seed.grab",
            ],
            cwd=cms,
        )

        uploads_dir = cms / "storage" / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        cms_env = os.environ.copy()
        cms_env["GRABLAB_MASTER_KEY"] = "grex-builder-e2e-grablab-master-key-0123456789"
        cms_env["GRABLAB_UPLOAD_DIR"] = str(uploads_dir)
        cms_env["GRABLAB_MAX_UPLOAD_BYTES"] = "10485760"

        port = free_port()
        cms_out = (Path(td) / "cms.stdout.log").open("w+", encoding="utf-8", errors="replace")
        cms_err = (Path(td) / "cms.stderr.log").open("w+", encoding="utf-8", errors="replace")
        proc = subprocess.Popen(
            [
                str(GRAB_BIN),
                "serve",
                "--addr",
                f"127.0.0.1:{port}",
                "--allow-scripts",
                "--db-config",
                "grab.data.json",
                "--allow-db",
                "main:read-write",
                "--platform-config",
                "grab.platform.json",
                "--allow-cache",
                "cms:read-write",
                "--allow-cache",
                "cms:limit",
                "--allow-env",
                "GRABLAB_MASTER_KEY,GRABLAB_UPLOAD_DIR,GRABLAB_MAX_UPLOAD_BYTES",
                "--static",
                "public",
                "--allow-read",
                str(cms),
                "--allow-write",
                str(uploads_dir),
                "src/app.grab",
            ],
            cwd=str(cms),
            env=cms_env,
            stdout=cms_out,
            stderr=cms_err,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        try:
            wait_for_health(port, "/_health", proc=proc)

            jar = {}
            st, _, sc, _, setup_res = http_req(
                port,
                "POST",
                "/api/auth/setup",
                {"display_name": "Admin", "email": "admin@grex.local", "password": "GrexBuilder#Password123"},
            )
            assert st == 201, setup_res
            parse_cookies(sc, jar)
            csrf = setup_res["csrf_token"]

            # Activate exclusive `mode: "visual"` Grex Theme Builder theme
            st, _, _, _, act_res = http_req(
                port,
                "POST",
                "/api/admin/themes/activate",
                {"slug": "grex-builder"},
                headers={"X-CSRF-Token": csrf},
                cookies=jar,
            )
            assert st == 200 and act_res["active_theme"]["slug"] == "grex-builder" and act_res["mode"] == "visual", act_res

            # Verify only grex-builder is active (default-starter disabled)
            st, _, _, _, themes_res = http_req(port, "GET", "/api/themes")
            active_slugs = [t["slug"] for t in themes_res["themes"] if t["is_active"] == 1]
            assert active_slugs == ["grex-builder"], active_slugs

            # Verify primary routes render via Grex visual theme with ZERO wrapper <div>
            for route_path, expected_status in [
                ("/", 200),
                ("/blog", 200),
                ("/about", 200),
                ("/search?q=hello", 200),
                ("/nonexistent-grex-route", 404),
            ]:
                st, _, _, html, _ = http_req(port, "GET", route_path)
                assert st == expected_status, f"{route_path} returned {st}"
                assert "<div" not in html.lower(), f"Found forbidden <div> in {route_path}"

            # Verify `grab mcp` layout workflow creates entry draft and applies Grex layout node cleanly
            st, _, _, _, tok_res = http_req(
                port, "POST", "/api/auth/mcp-token", {}, headers={"X-CSRF-Token": csrf}, cookies=jar
            )
            assert st in (200, 201) and "token" in tok_res, (st, tok_res)
            mcp_hdr = {"Authorization": f"Bearer {tok_res['token']}"}

            st, _, _, _, ce_res = http_req(
                port,
                "POST",
                "/api/mcp/tools/create_entry_draft",
                {"arguments": {"content_type": "post", "slug": "grex-studio-post", "title": "Grex Studio Post"}},
                headers=mcp_hdr,
            )
            assert st in (200, 201) and "entry" in ce_res and "id" in ce_res["entry"], (st, ce_res)
            entry_id = ce_res["entry"]["id"]

            grex_layout = {
                "element": "Section",
                "tag": "section",
                "props": {"class": "grex-article-section"},
                "children": [
                    {"element": "Heading", "props": {"level": 2, "text": "Edited by Groxy AI + Grex Theme Builder"}},
                    {"element": "Text", "props": {"text": "Zero-div semantic Grex layout synced via MCP."}},
                ],
            }
            st, _, _, _, ul_res = http_req(
                port,
                "POST",
                "/api/mcp/tools/update_entry_layout",
                {"arguments": {"entry_id": entry_id, "layout": grex_layout}},
                headers=mcp_hdr,
            )
            body_html = ul_res.get("body_html") or (ul_res.get("entry") or {}).get("body_html", "")
            assert st == 200 and "<div" not in body_html.lower(), (st, ul_res)
            assert "Edited by Groxy AI + Grex Theme Builder" in body_html, ul_res

            # Verify GrabLab CMS v1.0.0 public Query & Menu contract endpoints work alongside Grex Builder
            st, _, _, _, cms_q = http_req(port, "GET", "/api/query")
            assert st == 200 and "items" in cms_q and "pagination" in cms_q, cms_q
            st, _, _, _, cms_m = http_req(port, "GET", "/api/menus/primary")
            assert st == 200, cms_m
        finally:
            proc.terminate()
            proc.wait(timeout=5)
            cms_out.close()
            cms_err.close()


def main():
    test_grab_static_checks()
    test_grab_html_templates()
    test_node_unit_and_dom_suite()
    test_live_studio_server()
    test_grablab_cms_visual_theme_integration()
    print("ALL 5 E2E VERIFICATION GATES PASSED (100%).")


if __name__ == "__main__":
    main()
