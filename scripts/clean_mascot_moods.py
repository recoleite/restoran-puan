#!/usr/bin/env python3
"""Mevcut duygu durumlu maskot PNG'lerinde arka plan ve halo temizliği."""
from pathlib import Path

from process_mascot_moods import clean_fringe, flood_transparent
from PIL import Image

MASCOTS = Path(__file__).resolve().parent.parent / "mascots"


def main() -> None:
    for path in sorted(MASCOTS.glob("*-*.png")):
        if path.stem.count("-") != 1:
            continue
        img = Image.open(path)
        img = flood_transparent(img)
        img = clean_fringe(img)
        img.save(path, "PNG", optimize=True)
        print(f"OK {path.name}")


if __name__ == "__main__":
    main()
