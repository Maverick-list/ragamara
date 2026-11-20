"""
NULAR — Blender 4.x Normalization, Collider & GLB Export Pipeline
(scripts/blender/export_glb.py)

Usage:
  blender --background assets/blender/source/rumah_joglo.blend \
    --python scripts/blender/export_glb.py -- --out assets/models/houses/rumah-joglo.glb --lod
"""

import argparse
import os
import sys

try:
    import bpy  # type: ignore
except ImportError:
    bpy = None


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser(description="NULAR Blender GLB Exporter")
    parser.add_argument("--out", required=True, help="Output .glb path")
    parser.add_argument("--lod", action="store_true", help="Also generate decimated LOD1 variant")
    return parser.parse_args(argv)


def normalize_and_export(out_path, generate_lod=False):
    if bpy is None:
        raise RuntimeError("This script must be executed inside Blender 4.x Python environment.")

    # Apply transforms cleanly to all meshes
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    if bpy.context.selected_objects:
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Ensure COLLISION collection exists; auto-generate bounding box colliders if absent
    has_collision = any("COLLISION" in o.name.upper() for o in bpy.data.objects)
    if not has_collision:
        for obj in list(bpy.data.objects):
            if obj.type == "MESH" and any(k in obj.name.upper() for k in ("WALL", "FLOOR", "DINDING", "LANTAI")):
                bpy.ops.mesh.primitive_cube_add(location=obj.location)
                col = bpy.context.active_object
                col.name = f"COLLISION_{obj.name}"
                col.dimensions = obj.dimensions
                col.hide_render = True

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_animations=True,
        export_yup=True,
    )

    if generate_lod:
        lod_path = out_path.replace(".glb", "-lod1.glb")
        for obj in bpy.data.objects:
            if obj.type == "MESH" and "COLLISION" not in obj.name.upper():
                mod = obj.modifiers.new(name="NularLOD", type="DECIMATE")
                mod.ratio = 0.5
        bpy.ops.export_scene.gltf(
            filepath=lod_path,
            export_format="GLB",
            export_apply=True,
            export_yup=True,
        )


if __name__ == "__main__":
    if bpy is None:
        print("NULAR Blender exporter syntax OK (run inside Blender 4.x to execute export).")
    else:
        args = parse_args()
        normalize_and_export(args.out, args.lod)
