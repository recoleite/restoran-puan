#!/usr/bin/env python3
"""Mevcut duygu durumlu maskot PNG'lerinde rembg ile arka plan temizliği."""
from __future__ import annotations

from pathlib import Path

from PIL import Image
from rembg import remove

from process_mascot_moods import fit_canvas, remove_background

MASCOTS = Path(__file__).resolve().parent.parent / "mascots"


def main() -> None:
    for path in sorted(MASCOTS.glob("*-*.png")):
        if path.stem.count("-") != 1:
            continue
        mood_suffix = path.stem.split("-", 1)[1]
        if mood_suffix not in {"neutral", "happy", "excited", "sad", "pout"}:
            continue
        raw = Image.open(path)
        final = fit_canvas(remove_background(raw))
        final.save(path, "PNG", optimize=True)
        print(f"OK {path.name}")


if __name__ == "__main__":
    main()
