#!/usr/bin/env python3
"""Rasterise recorded screenshot commands into JPEGs.

Reads tools/shots-data.json (produced by record-shots.mjs from the game's
own renderer) and paints each command with PIL, honouring clip polygons,
alpha and text rotation. Output goes to screenshots/ at 1280x720, each
file kept under the 256 KiB gate cap by stepping JPEG quality down.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH, HEIGHT = 1280, 720
MAX_BYTES = 262144
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_font_cache = {}


def parse_colour(value, alpha=1.0):
    if isinstance(value, str) and value.startswith("#"):
        hexpart = value[1:]
        r = int(hexpart[0:2], 16)
        g = int(hexpart[2:4], 16)
        b = int(hexpart[4:6], 16)
        return (r, g, b, int(255 * alpha))
    if isinstance(value, str) and value.startswith("rgb"):
        parts = value[value.index("(") + 1 : value.index(")")].split(",")
        r, g, b = (int(float(p)) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, int(255 * a * alpha))
    return (0, 0, 0, int(255 * alpha))


def get_font(size, bold):
    key = (round(size), bold)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, max(8, round(size)))
    return _font_cache[key]


def clip_mask(clip):
    if not clip:
        return None
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    for polygon in clip:
        if len(polygon) >= 3:
            draw.polygon([(p[0], p[1]) for p in polygon], fill=255)
    return mask


def composite(base, layer, clip):
    mask = clip_mask(clip)
    if mask is None:
        base.alpha_composite(layer)
    else:
        base.paste(layer, (0, 0), Image.composite(layer.split()[3], Image.new("L", (WIDTH, HEIGHT), 0), mask))


def draw_gradient(draw, command):
    points = command["points"]
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    stops = sorted(command["stops"], key=lambda s: s[0])
    vertical = abs(command["y1"] - command["y0"]) >= abs(command["x1"] - command["x0"])
    steps = 90
    for i in range(steps):
        t = i / (steps - 1)
        colour = stops[-1][1]
        for j in range(len(stops) - 1):
            if stops[j][0] <= t <= stops[j + 1][0]:
                span = stops[j + 1][0] - stops[j][0] or 1
                f = (t - stops[j][0]) / span
                c0 = parse_colour(stops[j][1])
                c1 = parse_colour(stops[j + 1][1])
                colour = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        rgba = colour if isinstance(colour, tuple) else parse_colour(colour)
        if len(rgba) == 3:
            rgba = (rgba[0], rgba[1], rgba[2], int(255 * command.get("alpha", 1)))
        if vertical:
            yy = y0 + (y1 - y0) * t
            draw.rectangle([x0, yy, x1, yy + (y1 - y0) / steps + 1], fill=rgba)
        else:
            xx = x0 + (x1 - x0) * t
            draw.rectangle([xx, y0, xx + (x1 - x0) / steps + 1, y1], fill=rgba)


def draw_text(layer, command):
    font = get_font(command["size"], command["bold"])
    colour = parse_colour(command["colour"], command.get("alpha", 1))
    align = {"left": "l", "center": "m", "right": "r"}.get(command["align"], "l")
    anchor = align + "s"
    angle = command.get("angle", 0)
    if abs(angle) < 0.01:
        draw = ImageDraw.Draw(layer)
        draw.text((command["x"], command["y"]), command["text"], font=font, fill=colour, anchor=anchor)
        return
    pad = 8
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bbox = probe.textbbox((0, 0), command["text"], font=font, anchor=anchor)
    w = int(bbox[2] - bbox[0]) + pad * 2
    h = int(bbox[3] - bbox[1]) + pad * 2
    text_img = Image.new("RGBA", (max(w, 2), max(h, 2)), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(text_img)
    tdraw.text((pad - bbox[0], pad - bbox[1]), command["text"], font=font, fill=colour, anchor=anchor)
    rotated = text_img.rotate(-math.degrees(angle), resample=Image.BICUBIC, expand=True)
    layer.alpha_composite(rotated, (int(command["x"] - rotated.width / 2), int(command["y"] - rotated.height / 2)))


def render(commands):
    base = Image.new("RGBA", (WIDTH, HEIGHT), (11, 21, 36, 255))
    for command in commands:
        layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        kind = command["type"]
        alpha = command.get("alpha", 1)
        if kind == "poly":
            pts = [(p[0], p[1]) for p in command["points"]]
            draw.polygon(pts, fill=parse_colour(command["fill"], alpha))
        elif kind == "lines":
            pts = [(p[0], p[1]) for p in command["points"]]
            if command.get("closed") and len(pts) > 2:
                pts = pts + [pts[0]]
            width = max(1, round(command["width"]))
            draw.line(pts, fill=parse_colour(command["stroke"], alpha), width=width, joint="curve")
            for px, py in pts:
                r = width / 2
                draw.ellipse([px - r, py - r, px + r, py + r], fill=parse_colour(command["stroke"], alpha))
        elif kind == "gradient":
            draw_gradient(draw, command)
        elif kind == "text":
            draw_text(layer, command)
        composite(base, layer, command.get("clip"))
    return base.convert("RGB")


def save_capped(image, path):
    for quality in (86, 80, 74, 68, 62, 56):
        image.save(path, "JPEG", quality=quality)
        if os.path.getsize(path) <= MAX_BYTES:
            return quality
    return quality


def main():
    data_path = os.path.join(ROOT, "tools", "shots-data.json")
    with open(data_path, "r", encoding="utf-8") as handle:
        shots = json.load(handle)
    out_dir = os.path.join(ROOT, "screenshots")
    os.makedirs(out_dir, exist_ok=True)
    for name in sorted(shots):
        image = render(shots[name])
        path = os.path.join(out_dir, name)
        quality = save_capped(image, path)
        print(f"{name}: {os.path.getsize(path)} bytes at quality {quality}")


if __name__ == "__main__":
    sys.exit(main())
