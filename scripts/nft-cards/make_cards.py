#!/usr/bin/env python3
"""Robotic Harvest Arm — NFT card background removal / export.

Input : raw card renders in ``raw/`` (one PNG per rarity, card on a flat
        background — pure black void or flat white, whichever the renderer gave).
Output: ``frontend/public/nft/cards/*.png`` — PNG-32 with a real transparent
        background, no fringe, all cards centred on one shared canvas, plus
        512 px WebP thumbs for card grids and a manifest for the frontend.

Usage:  python3 scripts/nft-cards/make_cards.py [--raw DIR] [--out DIR]
Requires: pillow, numpy, scipy
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

BAND = 3.0          # px of matting band around the silhouette
SHARPEN = (55, 1.2, 2)   # unsharp mask (percent, radius, threshold) on RGB only
ITEMS = [
    ("common", "Common", 0, "#9FE8F5"),
    ("uncommon", "Uncommon", 1, "#3DFF7A"),
    ("rare", "Rare", 2, "#3FA9FF"),
    ("epic", "Epic", 3, "#FF3DD1"),
    ("legendary", "Legendary", 4, "#FFC030"),
]


def mask_background_colour(a: np.ndarray) -> np.ndarray:
    s = 6
    ring = np.concatenate([
        a[:s].reshape(-1, 3), a[-s:].reshape(-1, 3),
        a[:, :s].reshape(-1, 3), a[:, -s:].reshape(-1, 3),
    ])
    return np.median(ring, axis=0)


def card_silhouette(a: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Hard mask of the single card object (interior detail always kept)."""
    mx = a.max(axis=2)
    if bg.mean() < 0.15:                       # card sits on a dark void
        far = mx > 0.035
    else:                                      # card sits on a light backdrop
        far = np.sqrt(((a - bg) ** 2).sum(axis=2)) > 0.06

    lab, n = ndimage.label(far, structure=np.ones((3, 3), bool))
    if n == 0:
        raise RuntimeError("no foreground found")
    sizes = ndimage.sum(far, lab, range(1, n + 1))
    core = lab == (int(np.argmax(sizes)) + 1)
    core = ndimage.binary_closing(core, np.ones((5, 5), bool))
    core = ndimage.binary_fill_holes(core)
    lab, n = ndimage.label(core, structure=np.ones((3, 3), bool))
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def cutout(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w, _ = a.shape
    bg = mask_background_colour(a)
    core = card_silhouette(a, bg)

    # alpha for the anti-aliased rim: solve obs = a*F + (1-a)*bg for a,
    # projecting on the (F - bg) axis, with F = nearest interior colour.
    dist, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    band = (~core) & (dist <= BAND)
    alpha = np.zeros((h, w), np.float32)
    alpha[core] = 1.0
    F = a[iy[band], ix[band]]
    obs = a[band]
    v = F - bg
    denom = (v * v).sum(axis=1)
    num = ((obs - bg) * v).sum(axis=1)
    alpha[band] = np.clip(np.where(denom > 1e-6, num / np.maximum(denom, 1e-6), 0.0), 0.0, 1.0)

    # un-mix the backdrop colour out of the semi-transparent rim (despill)
    A = np.maximum(alpha, 1e-3)[..., None]
    mixed = (alpha < 0.999)[..., None]
    rgb = np.where(mixed, np.clip((a - (1 - A) * bg) / A, 0.0, 1.0), a)

    al_img = Image.fromarray((alpha * 255 + 0.5).astype(np.uint8), "L")
    rgb_img = Image.fromarray((rgb * 255 + 0.5).astype(np.uint8), "RGB")
    rgb_img = rgb_img.filter(ImageFilter.UnsharpMask(
        radius=SHARPEN[1], percent=SHARPEN[0], threshold=SHARPEN[2]))
    out = rgb_img.convert("RGBA")
    out.putalpha(al_img)

    ys, xs = np.where(np.asarray(al_img) > 3)
    pad = 2
    box = (max(int(xs.min()) - pad, 0), max(int(ys.min()) - pad, 0),
           min(int(xs.max()) + 1 + pad, w), min(int(ys.max()) + 1 + pad, h))
    return out.crop(box)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=Path("/home/user/work/raw"), type=Path)
    ap.add_argument("--out", default=Path("frontend/public/nft/cards"), type=Path)
    args = ap.parse_args()

    out_dir = args.out
    webp_dir = out_dir / "webp"
    webp_dir.mkdir(parents=True, exist_ok=True)

    cards: dict[str, Image.Image] = {}
    for key, *_ in ITEMS:
        src = args.raw / f"{key}_raw.png"
        if not src.exists():
            print(f"!! missing {src}", file=sys.stderr)
            continue
        card = cutout(src)
        cards[key] = card
        print(f"{key:10s} -> {card.size[0]}x{card.size[1]}  bg removed")

    if not cards:
        return 1

    W = max(c.width for c in cards.values())
    H = max(c.height for c in cards.values())
    for key, card in cards.items():
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(card, ((W - card.width) // 2, (H - card.height) // 2))
        canvas.save(out_dir / f"{key}.png", optimize=True)
        thumb = canvas.copy()
        thumb.thumbnail((512, 512), Image.LANCZOS)
        thumb.save(webp_dir / f"{key}@512.webp", lossless=True, quality=100, method=6)
        print(f"   wrote {key}.png {canvas.size} + webp {thumb.size}")

    manifest = {
        "collection": "Robotic Harvest Arm",
        "subtitle": "Automated Collector",
        "canvas": {"width": W, "height": H},
        "format": "PNG-32 (RGBA) transparent background; webp/ = 512 px lossless thumbs",
        "items": [
            {"rarity": rarity, "rarityId": rid, "accent": accent,
             "file": f"{key}.png", "thumb": f"webp/{key}@512.webp"}
            for key, rarity, rid, accent in ITEMS if key in cards
        ],
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"canvas {W}x{H}\nwrote {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
