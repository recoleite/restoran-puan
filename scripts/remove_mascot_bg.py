#!/usr/bin/env python3
"""Maskot PNG arka planlarını şeffaf yap (damalı desen + açık renk)."""
from collections import deque
from pathlib import Path
from PIL import Image

MASCOT_DIR = Path(__file__).resolve().parent.parent / "mascots"
TOLERANCE = 38


def similar(c1, c2):
    return all(abs(int(a) - int(b)) <= TOLERANCE for a, b in zip(c1, c2))


def is_background_rgb(rgb):
    r, g, b = rgb
    # Damalı desen / gri-beyaz
    if abs(r - g) <= 18 and abs(g - b) <= 18 and min(r, g, b) >= 165:
        return True
    # Krem / beyaz düz arka plan
    if r >= 228 and g >= 224 and b >= 210:
        return True
    return False


def flood_transparent(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = set()
    q = deque()

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


def main():
    for path in sorted(MASCOT_DIR.glob("*.png")):
        img = Image.open(path)
        out = flood_transparent(img)
        out.save(path, "PNG", optimize=True)
        print(f"OK {path.name}")


if __name__ == "__main__":
    main()
