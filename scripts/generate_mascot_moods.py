#!/usr/bin/env python3
"""Duygu durumlu maskot PNG'leri üret (256×256, şeffaf arka plan)."""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw

SIZE = 256
OUT = Path(__file__).resolve().parent.parent / "mascots"
MOODS = ("neutral", "happy", "excited", "sad", "pout")

CHARACTERS = {
    "bear": {
        "body": (180, 130, 85),
        "belly": (235, 210, 175),
        "ear_inner": (210, 170, 130),
        "nose": (70, 45, 30),
        "cheek": (240, 170, 150),
    },
    "cat": {
        "body": (245, 150, 70),
        "belly": (255, 220, 185),
        "ear_inner": (255, 190, 150),
        "nose": (230, 120, 110),
        "cheek": (255, 170, 150),
    },
    "dog": {
        "body": (220, 175, 95),
        "belly": (255, 235, 200),
        "ear_inner": (200, 150, 80),
        "nose": (55, 40, 30),
        "cheek": (255, 190, 160),
    },
    "penguin": {
        "body": (45, 55, 75),
        "belly": (245, 248, 252),
        "ear_inner": (255, 210, 80),
        "nose": (255, 170, 60),
        "cheek": (255, 190, 170),
    },
    "fox": {
        "body": (240, 120, 55),
        "belly": (255, 235, 210),
        "ear_inner": (255, 210, 170),
        "nose": (45, 30, 25),
        "cheek": (255, 170, 140),
    },
    "rabbit": {
        "body": (250, 245, 240),
        "belly": (255, 252, 248),
        "ear_inner": (255, 190, 200),
        "nose": (230, 170, 180),
        "cheek": (255, 190, 200),
    },
}


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_shadow(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(0, 0, 0, 28))


def draw_eye(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    mood: str,
    white=(255, 255, 255),
    pupil=(35, 35, 45),
) -> None:
    if mood == "sad":
        draw.arc((x - 9, y - 4, x + 9, y + 10), start=200, end=340, fill=pupil, width=3)
        draw.ellipse((x - 2, y + 2, x + 2, y + 6), fill=pupil)
        return
    if mood == "pout":
        draw.line((x - 8, y + 2, x + 8, y + 2), fill=pupil, width=3)
        return

    draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=white)
    draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=pupil)
    draw.ellipse((x - 3, y - 5, x - 1, y - 3), fill=white)

    if mood == "excited":
        draw.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(255, 220, 80, 180), width=2)


def draw_mouth(draw: ImageDraw.ImageDraw, cx: int, cy: int, mood: str, color=(55, 40, 35)) -> None:
    if mood == "neutral":
        draw.arc((cx - 10, cy - 4, cx + 10, cy + 8), start=10, end=170, fill=color, width=2)
    elif mood == "happy":
        draw.arc((cx - 14, cy - 6, cx + 14, cy + 12), start=10, end=170, fill=color, width=3)
    elif mood == "excited":
        draw.ellipse((cx - 12, cy - 2, cx + 12, cy + 14), fill=(220, 80, 90))
        draw.ellipse((cx - 8, cy + 2, cx + 8, cy + 10), fill=(255, 180, 190))
    elif mood == "sad":
        draw.arc((cx - 12, cy + 2, cx + 12, cy + 16), start=190, end=350, fill=color, width=3)
    elif mood == "pout":
        draw.line((cx - 8, cy + 6, cx + 8, cy + 4), fill=color, width=3)


def draw_blush(draw: ImageDraw.ImageDraw, cx: int, cy: int, color, mood: str) -> None:
    if mood in ("happy", "excited", "pout"):
        draw.ellipse((cx - 38, cy - 2, cx - 18, cy + 10), fill=(*color[:3], 90))
        draw.ellipse((cx + 18, cy - 2, cx + 38, cy + 10), fill=(*color[:3], 90))


def draw_tear(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.ellipse((x - 3, y, x + 3, y + 8), fill=(120, 200, 255, 220))
    draw.ellipse((x - 2, y + 6, x + 2, y + 14), fill=(120, 200, 255, 180))


def draw_steam(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    for dx, dy, r in [(-18, -42, 6), (0, -50, 7), (18, -44, 5)]:
        draw.ellipse((cx + dx - r, cy + dy - r, cx + dx + r, cy + dy + r), fill=(180, 190, 205, 140))


def draw_sparkles(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    for dx, dy, s in [(34, -38, 8), (-36, -28, 6), (42, -8, 5)]:
        x, y = cx + dx, cy + dy
        draw.polygon(
            [(x, y - s), (x + s * 0.3, y - s * 0.3), (x + s, y), (x + s * 0.3, y + s * 0.3),
             (x, y + s), (x - s * 0.3, y + s * 0.3), (x - s, y), (x - s * 0.3, y - s * 0.3)],
            fill=(255, 210, 60, 230),
        )


def body_offset(mood: str) -> tuple[int, int, float]:
    if mood == "excited":
        return 0, -14, 1.04
    if mood == "sad":
        return 0, 8, 0.96
    if mood == "pout":
        return -6, 2, 1.0
    return 0, 0, 1.0


def draw_character(draw: ImageDraw.ImageDraw, char_id: str, mood: str) -> None:
    pal = CHARACTERS[char_id]
    ox, oy, scale = body_offset(mood)
    cx, cy = SIZE // 2 + ox, SIZE // 2 + 18 + oy

    draw_shadow(draw, cx, cy + 78, 52, 12)

    # Kuyruk / detay
    if char_id == "fox":
        draw.polygon(
            [(cx + 34, cy + 18), (cx + 62, cy - 8), (cx + 48, cy + 42), (cx + 28, cy + 36)],
            fill=pal["body"],
        )
        draw.polygon(
            [(cx + 40, cy + 24), (cx + 56, cy + 4), (cx + 46, cy + 38)],
            fill=pal["belly"],
        )
    elif char_id == "cat":
        draw.ellipse((cx + 28, cy + 24, cx + 58, cy + 44), fill=pal["body"])
    elif char_id == "dog":
        draw.ellipse((cx + 26, cy + 20, cx + 56, cy + 48), fill=pal["body"])
    elif char_id == "rabbit":
        draw.ellipse((cx + 30, cy + 30, cx + 48, cy + 46), fill=pal["body"])

    # Gövde
    bw, bh = int(74 * scale), int(82 * scale)
    draw.ellipse((cx - bw // 2, cy + 8, cx + bw // 2, cy + 8 + bh), fill=pal["body"])
    draw.ellipse((cx - bw // 2 + 8, cy + 18, cx + bw // 2 - 8, cy + 8 + bh - 6), fill=pal["belly"])

    # Kollar
    if mood == "pout":
        draw.rounded_rectangle((cx - 58, cy + 24, cx - 28, cy + 44), radius=10, fill=pal["body"])
        draw.rounded_rectangle((cx + 28, cy + 24, cx + 58, cy + 44), radius=10, fill=pal["body"])
    elif mood == "excited":
        draw.ellipse((cx - 62, cy - 8, cx - 34, cy + 20), fill=pal["body"])
        draw.ellipse((cx + 34, cy - 8, cx + 62, cy + 20), fill=pal["body"])
    else:
        arm_y = cy + 28 + (6 if mood == "sad" else 0)
        draw.ellipse((cx - 58, arm_y, cx - 32, arm_y + 24), fill=pal["body"])
        draw.ellipse((cx + 32, arm_y, cx + 58, arm_y + 24), fill=pal["body"])

    # Bacaklar
    foot_y = cy + 72
    draw.rounded_rectangle((cx - 28, foot_y, cx - 8, foot_y + 18), radius=8, fill=pal["body"])
    draw.rounded_rectangle((cx + 8, foot_y, cx + 28, foot_y + 18), radius=8, fill=pal["body"])

    # Kafa
    head_r = int(46 * scale)
    head_cy = cy - 28 + (4 if mood == "sad" else 0)
    draw.ellipse((cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r), fill=pal["body"])

    # Kulaklar
    if char_id in ("bear", "cat", "dog", "fox"):
        ear_y = head_cy - head_r + 6
        draw.ellipse((cx - 38, ear_y - 18, cx - 14, ear_y + 10), fill=pal["body"])
        draw.ellipse((cx + 14, ear_y - 18, cx + 38, ear_y + 10), fill=pal["body"])
        draw.ellipse((cx - 32, ear_y - 10, cx - 18, ear_y + 4), fill=pal["ear_inner"])
        draw.ellipse((cx + 18, ear_y - 10, cx + 32, ear_y + 4), fill=pal["ear_inner"])
    elif char_id == "rabbit":
        draw.rounded_rectangle((cx - 34, head_cy - 78, cx - 16, head_cy - 8), radius=12, fill=pal["body"])
        draw.rounded_rectangle((cx + 16, head_cy - 78, cx + 34, head_cy - 8), radius=12, fill=pal["body"])
        draw.rounded_rectangle((cx - 30, head_cy - 72, cx - 20, head_cy - 12), radius=8, fill=pal["ear_inner"])
        draw.rounded_rectangle((cx + 20, head_cy - 72, cx + 30, head_cy - 12), radius=8, fill=pal["ear_inner"])
    elif char_id == "penguin":
        draw.ellipse((cx - 34, head_cy - 52, cx - 10, head_cy - 18), fill=pal["body"])
        draw.ellipse((cx + 10, head_cy - 52, cx + 34, head_cy - 18), fill=pal["body"])

    # Yüz alanı (açık)
    draw.ellipse((cx - 30, head_cy - 18, cx + 30, head_cy + 24), fill=pal["belly"])

    # Gözler & ağız
    eye_y = head_cy + 2
    if mood == "pout":
        draw_eye(draw, cx - 16, eye_y, mood)
        draw_eye(draw, cx + 16, eye_y, mood)
    else:
        draw_eye(draw, cx - 16, eye_y, mood)
        draw_eye(draw, cx + 16, eye_y, mood)

    nose_y = head_cy + 12
    if char_id == "penguin":
        draw.polygon([(cx, nose_y - 4), (cx - 8, nose_y + 6), (cx + 8, nose_y + 6)], fill=pal["nose"])
    else:
        draw.ellipse((cx - 6, nose_y, cx + 6, nose_y + 8), fill=pal["nose"])

    draw_mouth(draw, cx, head_cy + 22, mood)
    draw_blush(draw, cx, head_cy + 10, pal["cheek"], mood)

    if mood == "sad":
        draw_tear(draw, cx + 20, eye_y + 6)
    if mood == "pout":
        draw_steam(draw, cx, head_cy - head_r)
    if mood == "excited":
        draw_sparkles(draw, cx, head_cy - head_r)


def render(char_id: str, mood: str) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_character(draw, char_id, mood)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for char_id in CHARACTERS:
        for mood in MOODS:
            out = OUT / f"{char_id}-{mood}.png"
            render(char_id, mood).save(out, "PNG", optimize=True)
            print(f"OK {out.name}")


if __name__ == "__main__":
    main()
