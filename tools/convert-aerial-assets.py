"""Convert aerial presentation PNGs (filename contains each uuid key) to WebP.

Usage:
  python tools/convert-aerial-assets.py [path-to-folder-with-pngs]

Defaults to Cursor workspace assets if that folder exists, else tools/aerial-import.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
CURSOR_ASSETS = Path.home() / ".cursor/projects/c-Users-sharm-Downloads-projects-citius-travel-website/assets"
DEFAULT_IMPORT = CURSOR_ASSETS if CURSOR_ASSETS.is_dir() else REPO / "tools" / "aerial-import"
ASSETS = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_IMPORT
OUT = REPO / "public" / "gallery" / "spiritual"

# uuid fragment in filename -> output basename (no extension)
MAP = {
    "image-38f4b00f-82f0-4687-8458-d2120360a2aa": "aerial-hero-sky-path-2026",
    "image-6cdd49fd-98d8-40f0-a1bf-5e1006d0a990": "aerial-promo-overview",
    "image-2831b1b8-412f-4d68-9904-ae316df76b5a": "aerial-daywise-summary",
    "image-29f850a3-4e58-4e6c-9d26-727dda99f835": "aerial-day1-lucknow",
    "image-c97c1397-4cf9-4f15-bf99-af639a491da5": "aerial-day2-kailash-flight",
    "image-39b1d247-985f-4e53-b18e-bf3a53d86a81": "aerial-day3-mission-complete",
    "image-11f53410-ca13-4b91-85e1-f2f2a2d8e652": "aerial-memories-kit",
    "image-67ba6fe9-a716-48f8-9bcc-a9426d8ac640": "aerial-post-darshan-mansarovar-yatra",
    "image-790adf27-7ea3-47b3-a331-7ce7d8f92531": "aerial-brand-montage",
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, stem in MAP.items():
        src = next(ASSETS.glob(f"*{name}*.png"), None)
        if not src or not src.is_file():
            raise SystemExit(f"Missing source for {name}")
        dest = OUT / f"{stem}.webp"
        im = Image.open(src).convert("RGBA")
        im.save(dest, "WEBP", quality=92, method=6)
        print(f"OK {dest.name} <= {src.name} ({im.size[0]}x{im.size[1]})")


if __name__ == "__main__":
    main()
