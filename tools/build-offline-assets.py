#!/usr/bin/env python3
"""Regenerate offline-assets.json after adding or removing app runtime files."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_ASSET_SUFFIXES = {".js", ".mjs", ".css", ".woff2", ".bcmap", ".ttf", ".pfb"}


def main() -> None:
    assets = {
        "./",
        "./index.html",
        "./app.js",
        "./fonts.css",
        "./manifest.webmanifest",
        "./app-icon.svg",
        "./app-icon-192.png",
        "./app-icon-512.png",
        "./sw.js",
        "./theme-bootstrap.js",
        "./offline-assets.json",
    }
    for directory in (ROOT / "fonts", ROOT / "vendor"):
        for path in directory.rglob("*"):
            if path.is_file() and path.suffix.lower() in ALLOWED_ASSET_SUFFIXES:
                assets.add("./" + path.relative_to(ROOT).as_posix())
    missing = sorted(asset for asset in assets if not (ROOT / asset.removeprefix("./")).is_file() and asset not in ("./", "./offline-assets.json"))
    if missing:
        raise SystemExit("Missing offline assets:\n" + "\n".join(missing))
    destination = ROOT / "offline-assets.json"
    destination.write_text(json.dumps(sorted(assets), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(assets)} same-origin runtime assets to {destination.name}")


if __name__ == "__main__":
    main()
