"""Sample object names, modifiers and visibility per top-level collection (run inside Blender)."""
import bpy, random
from collections import Counter
random.seed(1)
for cname in ['1: Skeletal system', '4: Muscular system', '9: Regions of human body', '7: Nervous system & Sense organs', '3: Joints']:
    col = bpy.data.collections[cname]
    meshes = [o for o in col.all_objects if o.type in ('MESH', 'CURVE')]
    mods = Counter(m.type for o in meshes for m in o.modifiers)
    suffix = Counter(o.name.rsplit('.', 1)[-1] if '.' in o.name else '-' for o in meshes)
    hidden = sum(o.hide_get() or o.hide_viewport or o.hide_render for o in meshes)
    print(f"\n== {cname}: {len(meshes)} mesh/curve, modifiers={dict(mods)}, hidden={hidden}")
    print('   suffixes:', suffix.most_common(8))
    print('   sample:', [o.name for o in random.sample(meshes, min(30, len(meshes)))])
    print('   children:', [c.name for c in col.children][:20])
