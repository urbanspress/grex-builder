#!/usr/bin/env python3
"""
Package the exclusive `mode: "visual"` Grex Theme Builder package (`theme/`) into
`dist/grex-builder-v<version>-theme.zip` and generate `dist/SHA256SUMS.txt`.

Enforces GrabLab CMS v1.0.0 (`GRAB-E401`) package safety limits before writing:
  - <= 128 archive entries
  - <= 10 MiB total archive uncompressed size
  - Clean POSIX zip paths under `grex-builder/` with zero path traversal or symlink entries
  - Valid `theme.json` (`mode: "visual"`, `engine: "grex-visual"`) and zero `<div>` in `.grab.html` templates
"""

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
THEME_DIR = ROOT_DIR / "theme"
DIST_DIR = ROOT_DIR / "dist"
ALLOWED_EXTENSIONS = {".json", ".html", ".js", ".css", ".svg", ".md", ".txt"}
MAX_ENTRIES = 128
MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_theme_tree(theme_dir: Path) -> dict:
    manifest_path = theme_dir / "theme.json"
    elements_path = theme_dir / "grex.elements.json"
    assert manifest_path.is_file(), f"Missing {manifest_path}"
    assert elements_path.is_file(), f"Missing {elements_path}"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest.get("mode") == "visual", f"Expected mode='visual', got {manifest.get('mode')!r}"
    assert manifest.get("engine") == "grex-visual", f"Expected engine='grex-visual', got {manifest.get('engine')!r}"
    assert isinstance(manifest.get("themeHooks"), list), "themeHooks must be an array for GrabLab CMS v1.0.0"

    files = sorted(p for p in theme_dir.rglob("*") if p.is_file())
    assert 0 < len(files) <= MAX_ENTRIES, f"File count {len(files)} exceeds limit {MAX_ENTRIES}"

    total_bytes = 0
    for f in files:
        if f.is_symlink():
            raise ValueError(f"Symlink not permitted in theme package: {f}")
        suffix = "".join(f.suffixes[-1:]) if f.suffix else ""
        if suffix not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported theme file extension {suffix!r} on {f}")
        if f.name.endswith(".grab.html"):
            raw = f.read_text(encoding="utf-8")
            if "<div" in raw.lower():
                raise ValueError(f"Forbidden wrapper <div> detected in template {f}")
        total_bytes += f.stat().st_size

    assert total_bytes <= MAX_UNCOMPRESSED_BYTES, f"Package exceeds {MAX_UNCOMPRESSED_BYTES} bytes"
    return manifest


def build_theme_zip(version: str) -> Path:
    manifest = verify_theme_tree(THEME_DIR)
    slug = manifest["slug"]
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = DIST_DIR / f"grex-builder-v{version}-theme.zip"

    files = sorted(p for p in THEME_DIR.rglob("*") if p.is_file())
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            rel = f.relative_to(THEME_DIR).as_posix()
            arcname = f"{slug}/{rel}"
            zinfo = zipfile.ZipInfo(arcname, date_time=(2026, 11, 14, 0, 0, 0))
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(zinfo, f.read_bytes())

    return zip_path


def write_checksums(version: str, zip_path: Path) -> Path:
    assets = [zip_path]
    pdf_path = ROOT_DIR / "docs" / "releases" / "pdf" / f"Grex-Builder-v{version}-Guide.pdf"
    if pdf_path.is_file():
        assets.append(pdf_path)

    lines = [f"{sha256_file(p)}  {p.name}" for p in assets]
    sums_path = DIST_DIR / "SHA256SUMS.txt"
    sums_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return sums_path


def main():
    parser = argparse.ArgumentParser(description="Package Grex Theme Builder theme archive and SHA256SUMS.txt")
    parser.add_argument("--version", default="0.1.0", help="Release version without leading 'v'")
    args = parser.parse_args()

    zip_path = build_theme_zip(args.version)
    sums_path = write_checksums(args.version, zip_path)
    print(f"Packaged: {zip_path}")
    print(f"Checksums: {sums_path}")
    print(sums_path.read_text(encoding="utf-8").strip())


if __name__ == "__main__":
    main()
