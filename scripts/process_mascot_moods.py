#!/usr/bin/env python3
"""Duygu durumlu maskot PNG'lerini kopyala, boyutlandır ve arka planı temizle."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = Path.home() / ".cursor" / "projects" / "Users-recepmac-Documents-proje" / "assets"
MASCOTS = Path(__file__).resolve().parent.parent / "mascots"
MOODS = ("neutral", "happy", "excited", "sad", "pout")
CHARACTERS = ("bear", "cat", "dog", "fox", "penguin", "rabbit")
SIZE = 256
TOLERANCE = 42


def is_background_rgb(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    if abs(r - g) <= 20 and abs(g - b) <= 20 and min(r, g, b) >= 160:
        return True
    if r >= 225 and g >= 222 and b >= 208:
        return True
    return False


def flood_transparent(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    visited: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        rgb = px[x, y][:3]
        if not is_background_rgb(rgb):
            continue
        px[x, y] = (rgb[0], rgb[1], rgb[2], 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def fit_canvas(img: Image.Image, size: int = SIZE) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    scale = min(size / w, size / h) * 0.92
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - nw) // 2, size - nh - 8), img)
    return canvas


def clean_fringe(img: Image.Image) -> Image.Image:
    """Şeffaf kenara bitişik arka plan piksellerini temizle."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    for _ in range(4):
        to_clear: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0 or not is_background_rgb(px[x, y][:3]):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        to_clear.append((x, y))
                        break
        if not to_clear:
            break
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)
    return img


def main() -> None:
    for char in CHARACTERS:
        for mood in MOODS:
            src = ASSETS / f"{char}-{mood}.png"
            if not src.exists():
                print(f"SKIP missing {src.name}")
                continue
            out = MASCOTS / f"{char}-{mood}.png"
            img = Image.open(src)
            img = fit_canvas(img)
            img = flood_transparent(img)
            img = clean_fringe(img)
            img.save(out, "PNG", optimize=True)
            print(f"OK {out.name} ({out.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
