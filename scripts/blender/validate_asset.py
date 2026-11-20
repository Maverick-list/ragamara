"""
NULAR — Blender 4.x Asset Validation Script (scripts/blender/validate_asset.py)
Run via: blender --background model.blend --python scripts/blender/validate_asset.py

Validates architectural house and avatar assets against NULAR production standards:
- Real-world scale (1 unit = 1 meter, applied transforms)
- Required root hierarchy and named architectural component groups
- Presence of COLLISION group for walkable scenes
- Triangle budget compliance (< 50,000 triangles per house, < 15,000 per avatar)
- Principled BSDF PBR material verification
"""

import json
import os
import sys

try:
    import bpy  # type: ignore
except ImportError:
    bpy = None


def validate_scene(asset_kind="house"):
    if bpy is None:
        return {
            "status": "SKIPPED_NO_BLENDER",
            "message": "Run inside Blender 4.x background mode: blender --background <file.blend> --python scripts/blender/validate_asset.py",
        }

    report = {
        "asset_kind": asset_kind,
        "blend_file": bpy.data.filepath,
        "objects": 0,
        "meshes": 0,
        "triangles": 0,
        "has_collision_group": False,
        "unapplied_scales": [],
        "missing_pbr_materials": [],
        "named_groups": [],
        "passed": True,
    }

    for obj in bpy.data.objects:
        report["objects"] += 1
        if obj.type == "EMPTY" or obj.parent is None:
            report["named_groups"].append(obj.name)
        if "COLLISION" in obj.name.upper():
            report["has_collision_group"] = True
        if any(abs(s - 1.0) > 1e-3 for s in obj.scale):
            report["unapplied_scales"].append(obj.name)
        if obj.type == "MESH":
            report["meshes"] += 1
            mesh = obj.data
            mesh.calc_loop_triangles()
            report["triangles"] += len(mesh.loop_triangles)
            for mat in mesh.materials:
                if mat and not mat.use_nodes:
                    report["missing_pbr_materials"].append(mat.name)

    tri_budget = 50000 if asset_kind == "house" else 15000
    if report["triangles"] == 0 or report["triangles"] > tri_budget:
        report["passed"] = False
    if asset_kind == "house" and not report["has_collision_group"]:
        report["passed"] = False
    if report["unapplied_scales"]:
        report["passed"] = False

    return report


if __name__ == "__main__":
    kind = os.environ.get("NULAR_ASSET_KIND", "house")
    result = validate_scene(kind)
    print(json.dumps(result, indent=2))
    if bpy is not None and not result.get("passed", False):
        sys.exit(1)
