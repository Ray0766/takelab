"""Generate TakeLab's original demo clips. Requires Python, Pillow, NumPy, FFmpeg.

No external images or model output. Deterministic procedural artwork under the
repository's MIT license. Run from any directory: python scripts/generate_demo.py
"""
from pathlib import Path
import json
import math
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demo"
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS, SECONDS = 640, 360, 24, 6
rng = np.random.default_rng(42810)
noise = rng.random((140, 140))
noise_image = Image.fromarray((noise * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2))
surface = np.asarray(noise_image) / 255
yy, xx = np.mgrid[-1:1:140j, -1:1:140j]
zz = np.sqrt(np.maximum(0, 1 - xx * xx - yy * yy))
lighting = np.clip(-xx * .64 - yy * .4 + zz * .58, 0, 1)
texture = np.clip(.7 + surface * .35 + .03 * np.sin(xx * 48 + yy * 31), 0, 1)
mask = (xx * xx + yy * yy <= 1).astype(np.float64)
stars = [(int(rng.integers(0, W)), int(rng.integers(0, 230)), int(rng.integers(65, 130))) for _ in range(65)]
colors = [(122, 117, 103), (111, 132, 143), (111, 116, 149), (151, 123, 111), (102, 132, 139), (134, 122, 152), (132, 140, 136), (139, 111, 108), (129, 125, 151)]


def base_scene(index):
    horizon = np.array(colors[index])
    upper = np.array([21, 30, 43]) + (index % 3) * 2
    y = np.linspace(0, 1, H)[:, None, None]
    gradient = upper[None, None, :] * (1 - y ** 1.7) + horizon[None, None, :] * y ** 1.7
    array = np.broadcast_to(gradient, (H, W, 3)).copy()
    gx, gy = np.meshgrid(np.arange(W), np.arange(H))
    glow = np.exp(-((gx - 380) ** 2 / 140000 + (gy - 240) ** 2 / 9000)) * 17
    array += glow[:, :, None]
    image = Image.fromarray(np.clip(array, 0, 255).astype("uint8")).convert("RGBA")
    draw = ImageDraw.Draw(image)
    for x, y, brightness in stars:
        draw.ellipse((x, y, x + .6, y + .6), fill=(brightness, brightness + 4, brightness + 12, 255))
    # Four silhouettes establish depth without appropriating any external footage.
    for layer, (baseline, amplitude, color) in enumerate([(262, 19, (54, 61, 66)), (285, 23, (38, 47, 57)), (317, 35, (24, 33, 44)), (352, 18, (17, 25, 35))]):
        points = []
        for x in range(-10, W + 11, 4):
            y = baseline + math.sin(x / 87 + layer * 2.4) * amplitude + math.sin(x / 33 + layer * 2) * amplitude * .24
            points.append((x, int(y)))
        draw.polygon(points + [(W + 10, H), (-10, H)], fill=color + (255,))
        if layer == 1:
            draw.line(points, fill=(100, 103, 103, 130), width=1)
    # Tiny observation station and its warm window anchor the scale.
    draw.rectangle((124, 249, 138, 268), fill=(29, 37, 46, 255))
    draw.polygon([(121, 250), (131, 239), (141, 250)], fill=(38, 47, 56, 255))
    draw.line((131, 239, 131, 224), fill=(48, 56, 63), width=1)
    draw.rectangle((129, 253, 133, 257), fill=(226, 191, 130, 255))
    return image


def moon_image(index):
    lit = lighting * texture
    light_color = np.array([(229, 216, 183), (212, 220, 219), (226, 216, 211)][index % 3])
    shade = np.array([42, 53, 65])
    rgb = shade[None, None, :] + lit[:, :, None] * (light_color - shade)[None, None, :]
    rgba = np.concatenate((rgb, (mask * 255)[:, :, None]), axis=2)
    return Image.fromarray(np.clip(rgba, 0, 255).astype("uint8"))


def make_frame(base, moon, index, frame):
    time = frame / FPS
    phase = time / SECONDS
    x = int(355 + math.sin(phase * 1.1) * (12 if index != 1 else 45))
    y = int(139 - phase * (5 if index != 4 else 14))
    canvas = base.copy()
    ring_layer = Image.new("RGBA", (W, H))
    ring_draw = ImageDraw.Draw(ring_layer)
    # Tilted elliptical orbital track, with a break in take six.
    points = []
    angle = -.35 + .035 * math.sin(phase * 2)
    for n in range(361):
        if index == 5 and time > 3.6 and 12 < n < 65:
            if points:
                ring_draw.line(points, fill=(206, 199, 182, 170), width=1)
                points = []
            continue
        a = math.radians(n)
        rx, ry = math.cos(a) * 116, math.sin(a) * 28
        points.append((x + rx * math.cos(angle) - ry * math.sin(angle), y + rx * math.sin(angle) + ry * math.cos(angle)))
    ring_draw.line(points, fill=(206, 199, 182, 170), width=1)
    canvas.alpha_composite(ring_layer)
    canvas.alpha_composite(moon, (x - 70, y - 70))
    # Foreground half of the ring gives the moon dimensionality.
    front = Image.new("RGBA", (W, H))
    front_draw = ImageDraw.Draw(front)
    front_points = []
    for n in range(0, 181):
        if index == 5 and time > 3.6 and 12 < n < 65:
            if front_points:
                front_draw.line(front_points, fill=(222, 211, 182, 180), width=1)
                front_points = []
            continue
        a = math.radians(n)
        rx, ry = math.cos(a) * 116, math.sin(a) * 28
        front_points.append((x + rx * math.cos(angle) - ry * math.sin(angle), y + rx * math.sin(angle) + ry * math.cos(angle)))
    if front_points:
        front_draw.line(front_points, fill=(222, 211, 182, 180), width=1)
    a = phase * math.pi * 1.4 + .3
    rx, ry = math.cos(a) * 116, math.sin(a) * 28
    sx = x + rx * math.cos(angle) - ry * math.sin(angle)
    sy = y + rx * math.sin(angle) + ry * math.cos(angle)
    front_draw.ellipse((sx - 2, sy - 2, sx + 2, sy + 2), fill=(239, 222, 184, 255))
    canvas.alpha_composite(front)
    if index == 7 and 2.4 < time < 4.1:
        canvas.alpha_composite(moon.resize((57, 57), Image.Resampling.LANCZOS), (460, 109))
    if index == 3 and 2.75 < time < 3.05:
        canvas = Image.blend(canvas, Image.new("RGBA", (W, H), (235, 219, 196, 255)), .18)
    if index == 8:
        canvas = canvas.filter(ImageFilter.GaussianBlur(1.4))
    return canvas.convert("RGB").tobytes()


manifest = {}
for index in range(9):
    filename = f"orbit-{index + 1:02}.mp4"
    destination = OUT / filename
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    base, moon = base_scene(index), moon_image(index)
    try:
        for frame in range(FPS * SECONDS):
            process.stdin.write(make_frame(base, moon, index, frame))
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"FFmpeg failed for {filename}")
    manifest[filename] = destination.stat().st_size
    print(f"Generated {filename}: {manifest[filename]:,} bytes", flush=True)
    if index in (0, 3, 6):
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "2.8", "-i", str(destination), "-frames:v", "1", "-vf", "scale=640:-1", str(OUT / f"preview-{index + 1}.webp")], check=True)
(ROOT / "src" / "demo-assets.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
