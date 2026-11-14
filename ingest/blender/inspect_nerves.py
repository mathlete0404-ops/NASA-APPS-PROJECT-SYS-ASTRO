"""List peripheral-nerve object names and the body's bounding box / facing direction (run inside Blender)."""
import bpy
from mathutils import Vector
nerv = bpy.data.collections['7: Nervous system & Sense organs']
names = sorted({o.name.rsplit('.', 1)[0] for o in nerv.all_objects if o.type in ('MESH', 'CURVE') and ('nerve' in o.name.lower() or 'plexus' in o.name.lower() or 'spinal cord' in o.name.lower() or 'root' in o.name.lower())})
print('NERVES', len(names)); print(' | '.join(names))
def centroid(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return sum(pts, Vector()) / 8
bones = [o for o in bpy.data.collections['1: Skeletal system'].all_objects if o.type == 'MESH' and o.name.rsplit('.', 1)[-1] in ('r', 'l') or (o.type == 'MESH' and '.' not in o.name and o.name in bpy.data.collections['1: Skeletal system'].all_objects)]
zs = [ (o.matrix_world @ Vector(c)).z for o in bones for c in o.bound_box]
xs = [ (o.matrix_world @ Vector(c)).x for o in bones for c in o.bound_box]
print('BBOX z', min(zs), max(zs), 'x', min(xs), max(xs))
for n in ['Nasal bone.l', 'Occipital bone', 'Sternum', 'Sacrum', 'Femur.l', 'Femur.r', 'Patella.l', 'Calcaneus.l', 'Humerus.l', 'Scapula.l', 'Fifth lumbar vertebra (L5)', 'Lumbar vertebrae']:
    o = bpy.data.objects.get(n)
    print(n, tuple(round(v, 3) for v in centroid(o)) if o else 'MISSING')
print('LUMBAR-like', [o.name for o in bpy.data.objects if 'lumbar' in o.name.lower() and o.type == 'MESH'][:20])
print('SKINLIKE', [o.name for o in bpy.data.objects if o.type == 'MESH' and ('skin' in o.name.lower() or 'body' == o.name.lower())][:20])
