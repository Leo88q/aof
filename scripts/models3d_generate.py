#!/usr/bin/env python3
"""Generate the organism placeholder 3D models (own CC0 placeholders).

Five tool models + SoulCore, built from trimesh primitives. No third-party
assets are downloaded: shapes are authored here so the client can ship them
under the project placeholder-art policy. Output GLBs plus manifest.json
with sha256 for every file, consumed by the organism scene loader.

Run:  python3 scripts/models3d_generate.py   (needs: trimesh, numpy)
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import trimesh

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "assets" / "models3d"


def colored(mesh, rgba):
    mesh.visual = trimesh.visual.ColorVisuals(mesh, face_colors=np.tile(rgba, (len(mesh.faces), 1)))
    return mesh


def box(extents, at, rgba):
    m = trimesh.creation.box(extents=extents)
    m.apply_translation(at)
    return colored(m, rgba)


def cyl(radius, height, at, rgba, axis=None, sections=24):
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "x":
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    if axis == "z":
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    m.apply_translation(at)
    return colored(m, rgba)


def cone(radius, height, at, rgba):
    m = trimesh.creation.cone(radius=radius, height=height, sections=24)
    m.apply_translation(at)
    return colored(m, rgba)


def ball(radius, at, rgba, detail=2):
    m = trimesh.creation.icosphere(subdivisions=detail, radius=radius)
    m.apply_translation(at)
    return colored(m, rgba)


STEEL = [122, 144, 168, 255]
DARK = [38, 48, 60, 255]
ACCENT = [242, 166, 60, 255]
TEAL = [70, 200, 180, 255]
VIOLET = [150, 110, 240, 255]
GREEN = [110, 220, 150, 255]
GOLD = [242, 193, 78, 255]

MODELS = {
    # Disc cutter on a handle.
    "plasma_cutter": [
        box([0.16, 0.5, 0.16], [0, -0.1, 0], DARK),
        cyl(0.3, 0.08, [0, 0.35, 0], STEEL, axis="z"),
        cyl(0.1, 0.12, [0, 0.35, 0], ACCENT, axis="z"),
    ],
    # Drill extractor.
    "silicon_extractor": [
        box([0.34, 0.22, 0.34], [0, 0.32, 0], STEEL),
        cone(0.16, 0.55, [0, -0.05, 0], ACCENT),
        cyl(0.05, 0.2, [0, 0.53, 0], DARK),
    ],
    # Dish harvester.
    "data_harvester": [
        cyl(0.06, 0.5, [0, 0.0, 0], DARK),
        cone(0.34, 0.2, [0, 0.38, 0], TEAL),
        ball(0.07, [0, 0.55, 0], TEAL),
        box([0.3, 0.08, 0.3], [0, -0.3, 0], STEEL),
    ],
    # Antenna transmitter.
    "quantum_transmitter": [
        cyl(0.05, 0.75, [0, 0.05, 0], STEEL),
        ball(0.11, [0, 0.5, 0], VIOLET),
        cyl(0.02, 0.3, [0.18, 0.25, 0], VIOLET, axis="x"),
        box([0.34, 0.08, 0.34], [0, -0.35, 0], DARK),
    ],
    # Seeder pod with sprout.
    "neural_seeder": [
        ball(0.24, [0, -0.12, 0], GREEN),
        cone(0.1, 0.35, [0, 0.28, 0], GREEN),
        ball(0.08, [0.12, 0.42, 0], TEAL),
        box([0.3, 0.07, 0.3], [0, -0.4, 0], DARK),
    ],
}

SOUL = [ball(0.32, [0, 0, 0], GOLD, detail=1)]


def main() -> None:
    tools_dir = OUT / "tools"
    tools_dir.mkdir(parents=True, exist_ok=True)
    entries = {}
    for name, parts in MODELS.items():
        path = tools_dir / f"{name}.glb"
        trimesh.Scene(parts).export(path)
        entries[name] = {"model": f"tools/{name}.glb", "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    soul_path = OUT / "soul_core.glb"
    trimesh.Scene(SOUL).export(soul_path)
    manifest = {
        "version": 1,
        "license": "CC0 placeholders generated in-repo by scripts/models3d_generate.py",
        "tools": entries,
        "soulCore": {"model": "soul_core.glb", "sha256": hashlib.sha256(soul_path.read_bytes()).hexdigest()},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} tool models + soul_core + manifest under {OUT}")


if __name__ == "__main__":
    main()
