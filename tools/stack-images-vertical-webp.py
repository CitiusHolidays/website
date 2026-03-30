#!/usr/bin/env python3
"""
Stack two raster images vertically (top above bottom, flush, no gap) into one WebP file.

Uses Pillow (https://pillow.readthedocs.io/):
  pip install Pillow

Example (Day 13-style collage):
  python tools/stack-images-vertical-webp.py \\
    --top path/to/day13-top.jpg \\
    --bottom path/to/day13-bottom.jpg \\
    --out public/gallery/spiritual/kathmandu-return-day13-16x10.webp

Use --equal-panels when one photo is much shorter after scaling: each half of the
output gets the same height (center crop / cover), so the split does not look
like a thin strip plus a tall panel.

Then set src on the itinerary entry in src/data/trails.js. If the collage is tall,
center-crop export to true 16:10 (e.g. 1920x1200) in Pillow so next/image object-cover
matches other days without side bars or uneven crops.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def scale_to_width(im: Image.Image, width: int) -> Image.Image:
    w, h = im.size
    if w == width:
        return im
    new_h = max(1, int(round(h * (width / w))))
    return im.resize((width, new_h), Image.Resampling.LANCZOS)


def cover_panel(im: Image.Image, tw: int, th: int) -> Image.Image:
    """Scale and center-crop so the result exactly fills tw x th (like CSS object-cover)."""
    im = im.convert("RGB")
    w, h = im.size
    scale = max(tw / w, th / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def stack_vertical(
    top: Image.Image,
    bottom: Image.Image,
    *,
    max_width: int | None,
) -> Image.Image:
    t = top.convert("RGB")
    b = bottom.convert("RGB")
    w1, _ = t.size
    w2, _ = b.size
    target_w = max(w1, w2)
    if max_width is not None and target_w > max_width:
        target_w = max_width

    t = scale_to_width(t, target_w)
    b = scale_to_width(b, target_w)
    h = t.height + b.height
    out = Image.new("RGB", (target_w, h))
    out.paste(t, (0, 0))
    out.paste(b, (0, t.height))
    return out


def stack_vertical_equal_panels(
    top: Image.Image,
    bottom: Image.Image,
    *,
    max_width: int | None,
) -> Image.Image:
    """Same width; each panel gets height = average of the two scaled heights (cover crop per panel)."""
    t = top.convert("RGB")
    b = bottom.convert("RGB")
    target_w = max(t.width, b.width)
    if max_width is not None and target_w > max_width:
        target_w = max_width

    t = scale_to_width(t, target_w)
    b = scale_to_width(b, target_w)
    panel_h = max(1, (t.height + b.height) // 2)
    t = cover_panel(t, target_w, panel_h)
    b = cover_panel(b, target_w, panel_h)
    out = Image.new("RGB", (target_w, panel_h * 2))
    out.paste(t, (0, 0))
    out.paste(b, (0, panel_h))
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--top", required=True, type=Path, help="Top half of the composite")
    p.add_argument("--bottom", required=True, type=Path, help="Bottom half of the composite")
    p.add_argument("--out", required=True, type=Path, help="Output .webp path")
    p.add_argument(
        "--max-width",
        type=int,
        default=2000,
        help="Max width in pixels (both layers scaled to the same width; default 2000). Use 0 for no cap.",
    )
    p.add_argument("--quality", type=int, default=92, help="WebP quality 0-100 (default 92)")
    p.add_argument(
        "--equal-panels",
        action="store_true",
        help="Give top and bottom the same height (center crop each after matching width). Recommended when one source is much shorter.",
    )
    args = p.parse_args()

    if not args.top.is_file():
        print(f"Missing --top: {args.top}", file=sys.stderr)
        sys.exit(1)
    if not args.bottom.is_file():
        print(f"Missing --bottom: {args.bottom}", file=sys.stderr)
        sys.exit(1)

    max_w = None if args.max_width == 0 else args.max_width

    top_im = Image.open(args.top)
    bot_im = Image.open(args.bottom)
    try:
        if args.equal_panels:
            composite = stack_vertical_equal_panels(top_im, bot_im, max_width=max_w)
        else:
            composite = stack_vertical(top_im, bot_im, max_width=max_w)
    finally:
        top_im.close()
        bot_im.close()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    composite.save(args.out, "WEBP", quality=args.quality, method=6)
    w, h = composite.size
    kb = args.out.stat().st_size // 1024
    print(f"Wrote {args.out}  size={w}x{h}  ({kb} KB)")


if __name__ == "__main__":
    main()
