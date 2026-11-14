"""Print the collection tree and object counts of the Z-Anatomy .blend (run inside Blender)."""
import bpy
from collections import Counter

def walk(col, depth=0, maxdepth=3):
    objs = list(col.all_objects)
    types = Counter(o.type for o in objs)
    verts = sum(len(o.data.vertices) for o in objs if o.type == 'MESH')
    print('  ' * depth + f"{col.name!r}: {len(objs)} objs {dict(types)} verts={verts}")
    if depth < maxdepth:
        for c in col.children:
            walk(c, depth + 1, maxdepth)

walk(bpy.context.scene.collection, 0, 3)
