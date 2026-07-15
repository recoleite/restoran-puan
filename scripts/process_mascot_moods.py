#!/usr/bin/env python3
"""Duygu durumlu maskot PNG'lerini rembg ile arka plansız işle."""
from __future__ import annotations

from pathlib import Path

from PIL import Image
from rembg import remove

ASSETS = Path.home() / ".cursor" / "projects" / "Users-recepmac-Documents-proje" / "assets"
MASCOTS = Path(__file__).resolve().parent.parent / "mascots"
MOODS = ("neutral", "happy", "excited", "sad", "pout")
CHARACTERS = ("bear", "cat", "dog", "fox", "penguin", "rabbit")
SIZE = 256


def trim_alpha(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def fit_canvas(img: Image.Image, size: int = SIZE) -> Image.Image:
    img = trim_alpha(img)
    w, h = img.size
    scale = min(size / w, size / h) * 0.92
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - nw) // 2, size - nh - 8), img)
    return canvas


def remove_background(img: Image.Image) -> Image.Image:
    return remove(img.convert("RGBA"))


def main() -> None:
    for char in CHARACTERS:
        for mood in MOODS:
            src = ASSETS / f"{char}-{mood}.png"
            if not src.exists():
                print(f"SKIP missing {src.name}")
                continue
            out = MASCOTS / f"{char}-{mood}.png"
            raw = Image.open(src)
            cutout = remove_background(raw)
            final = fit_canvas(cutout)
            final.save(out, "PNG", optimize=True)
            print(f"OK {out.name} ({out.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
