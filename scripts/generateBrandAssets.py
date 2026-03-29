#!/usr/bin/env python3
"""Generate SwiftDrop icon + native splash (obsidian + volt) — run from repo root."""
from pathlib import Path

from PIL import Image, ImageDraw

OBSIDIAN = (10, 10, 15)
OBSIDIAN_TOP = (20, 20, 31)
OBSIDIAN_DEEP = (5, 5, 8)
VOLT = (232, 255, 0)


def vertical_gradient(size, top_rgb, bottom_rgb):
    w, h = size
    im = Image.new("RGB", size)
    px = im.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top_rgb[0] + (bottom_rgb[0] - top_rgb[0]) * t)
        g = int(top_rgb[1] + (bottom_rgb[1] - top_rgb[1]) * t)
        b = int(top_rgb[2] + (bottom_rgb[2] - top_rgb[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return im


def draw_volt_mark(draw: ImageDraw.ImageDraw, box):
    """Rounded volt tile + obsidian arrow."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    r = max(8, int(0.22 * min(w, h)))
    draw.rounded_rectangle(box, radius=r, fill=VOLT)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    s = min(w, h) * 0.14
    body = [
        (cx - s * 1.1, cy - s * 0.35),
        (cx + s * 0.35, cy - s * 0.35),
        (cx + s * 0.35, cy - s * 0.9),
        (cx + s * 1.25, cy),
        (cx + s * 0.35, cy + s * 0.9),
        (cx + s * 0.35, cy + s * 0.35),
        (cx - s * 1.1, cy + s * 0.35),
    ]
    draw.polygon(body, fill=OBSIDIAN)


def make_icon(path: Path, size: int = 1024):
    im = Image.new("RGB", (size, size), OBSIDIAN)
    d = ImageDraw.Draw(im)
    pad = int(size * 0.22)
    box = (pad, pad, size - pad, size - pad)
    draw_volt_mark(d, box)
    im.save(path, "PNG", optimize=True)
    print(f"Wrote {path}")


def make_splash(path: Path, w: int = 1284, h: int = 2778):
    base = vertical_gradient((w, h), OBSIDIAN_TOP, OBSIDIAN_DEEP).convert("RGBA")
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gw = int(w * 1.15)
    gh = int(h * 0.2)
    gx0 = (w - gw) // 2
    gy0 = -gh // 2
    gd.ellipse([gx0, gy0, gx0 + gw, gy0 + gh], fill=(232, 255, 0, 35))
    im = Image.alpha_composite(base, glow).convert("RGB")
    d = ImageDraw.Draw(im)
    m = int(min(w, h) * 0.13)
    cx, cy = w // 2, int(h * 0.42)
    box = (cx - m, cy - m, cx + m, cy + m)
    ring_pad = 3
    rr = int(0.22 * (2 * m + 2 * ring_pad))
    d.rounded_rectangle(
        (
            box[0] - ring_pad,
            box[1] - ring_pad,
            box[2] + ring_pad,
            box[3] + ring_pad,
        ),
        radius=rr,
        outline=VOLT,
        width=2,
    )
    draw_volt_mark(d, box)
    im.save(path, "PNG", optimize=True)
    print(f"Wrote {path}")


def main():
    root = Path(__file__).resolve().parents[1]
    assets = root / "assets"
    assets.mkdir(exist_ok=True)
    make_icon(assets / "icon.png")
    make_splash(assets / "splash.png")


if __name__ == "__main__":
    main()
