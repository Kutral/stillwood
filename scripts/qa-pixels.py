"""Pixel-level sanity stats for QA screenshots (blank-screen / render checks)."""
import sys
from collections import Counter
from pathlib import Path

from PIL import Image


def stats(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    total = w * h
    greens = sky = dark = light = 0
    samples = []
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b = px[x, y]
            if g > r + 8 and g > b + 8:
                greens += 1
            if b > r + 10 and y < h // 3:
                sky += 1
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 24:
                dark += 1
            elif lum > 232:
                light += 1
            if x % 64 == 0 and y % 64 == 0:
                samples.append((r // 16, g // 16, b // 16))
    uniq = len(set(samples))
    counter = Counter(samples)
    top, topn = counter.most_common(1)[0]
    sampled = len(samples)
    return {
        "file": path.name,
        "size": f"{w}x{h}",
        "green_frac": round(greens / (total / 16), 3),
        "sky_top_frac": round(sky / (total / 16 / 3), 3),
        "very_dark_frac": round(dark / (total / 16), 3),
        "very_light_frac": round(light / (total / 16), 3),
        "unique_color_bins_64px_grid": f"{uniq}/{sampled}",
        "dominant_bin_share": round(topn / sampled, 3),
    }


if __name__ == "__main__":
    shots = sys.argv[1:] or ["qa-desktop.png", "qa-driving.png", "qa-mobile.png"]
    base = Path(__file__).resolve().parent.parent / "screenshots"
    out = [stats(base / s) for s in shots]
    ok = True
    for s in out:
        print(s)
        # Blank-frame heuristics: one color bin dominating or nothing but extremes.
        if s["dominant_bin_share"] > 0.85 or s["unique_color_bins_64px_grid"].split("/")[0] == "1":
            ok = False
            print(f"  !! SUSPECT BLANK: {s['file']}")
        else:
            print("  render-content: OK")
    sys.exit(0 if ok else 1)
