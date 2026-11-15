"""Export the Z-Anatomy atlas to web-ready, Draco-compressed glTF for Crew Mirror.

Run (headless, scripts in the .blend stay disabled):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --disable-autoexec \
      data/raw/zanatomy/Z-Anatomy/Startup.blend --python ingest/blender/export_body.py -- web/public/models

What it does (outline §6, done in code instead of by hand so it is repeatable):
  1. Picks real structures from the numbered Z-Anatomy collections — bones, muscles, skin
     regions, major peripheral nerves, discs/menisci — and skips helper objects
     (.i landmark points, .j/.g group objects, labels, fascia, bursae, tendon sheaths, teeth...).
  2. Evaluates each one (modifiers applied, curves → meshes), bakes its world transform,
     and decimates it so each layer fits a triangle budget for phones/laptops.
  3. Tags every node with glTF `extras` (three.js → userData): original Z-Anatomy name,
     layer, side, and the Crew Mirror body region used by triage and the pain-source finder.
  4. Writes skeleton.glb, muscles.glb, skin.glb, nerves.glb, joints.glb (Draco) plus
     anatomy_manifest.json (name → region/side/layer/centroid) for the web app.

Model: "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0", derived from
"BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan".
The exported files are derivative works and stay CC BY-SA 4.0.
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "web/public/models").resolve()
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST_OUT = Path(__file__).resolve().parents[2] / "web" / "src" / "generated" / "anatomy_manifest.json"

LAYERS = {
    "skeleton": "1: Skeletal system",
    "muscles": "4: Muscular system",
    "skin": "9: Regions of human body",
    "nerves": "7: Nervous system & Sense organs",
    "joints": "3: Joints",
}
# Triangle budget per layer (after decimation).
BUDGET = {"skeleton": 470_000, "muscles": 640_000, "skin": 70_000, "nerves": 110_000, "joints": 80_000}
MIN_TRIS = 160  # small bones/muscles keep their shape

# Sex-specific anatomy is left out so the model is neutral (genital region, pubic hair, breast/nipple, anal region).
SEX_SPECIFIC = re.compile(r"urogenital|pubic hair|mammary|nipple|areola|penis|penile|scrot|testi|glans|dartos|bulbospong|"
                          r"ischiocavern|cremaster|spermatic|clitor|vulva|vagin|labia|prepuce|corpus cavern|corpus spong|"
                          r"anal region|external anal sphincter|pubo-analis", re.I)
SKIP_ALL = re.compile(r"tooth|teeth|molar|incisor|canine tooth|premolar|malleus|incus|stapes|ossicle|"
                      r"fascia|bursa|tendon sheath|retinacul|aponeurosis of|reference|plane|"
                      r"cartilage of ear|nasal cartilage|laryngeal|arytenoid|cricoid|thyroid cartilage|epiglott|"
                      r"eyeball|lens|cornea|iris|retina|vitreous|tongue|intrinsic muscles of tongue|"
                      r"ocular|rectus muscle$|oblique muscle$|levator palpebrae|tarsus|tarsal plate|"
                      r"auricular muscle|tympan|cochlea|uvula|palat|pharyn|laryn|vocal", re.I)
NERVE_KEEP = re.compile(r"nerve|plexus|branch|ram(i|us)|root|trunk|cord|spinal", re.I)
NERVE_SKIP = re.compile(r"nucle|sulc|gyr|tract|horn|matter|funicul|cortex|lobe|ventric|cerebr|thalam|brainstem|pons|medulla|"
                        r"dura|pia mater|arachnoid|choroid|optic|olfactory|cochlear|vestibul|oculomotor|trochlear|abducens|"
                        r"intermediate zone|central structures|hypoglossal|glossopharyngeal|vagus|trigeminal|facial nerve|"
                        r"mandibular|maxillary|ophthalmic|lingual|alveolar|buccal nerve|mental nerve|mylohyoid|sympathetic", re.I)
JOINT_KEEP = re.compile(r"ligament|capsule|membrane|disc|menisc|symphysis|labrum|joint|intervertebral disc|meniscus|articular disc of temporomandibular|pubic symphysis|"
                        r"articular capsule of (hip|knee|shoulder|glenohumeral)|anterior cruciate|posterior cruciate|"
                        r"medial collateral ligament of knee|lateral collateral ligament of knee|"
                        r"anterior talofibular|calcaneofibular|iliolumbar|sacro-?iliac", re.I)

REGIONS = ["head", "neck", "shoulder", "upper_back", "lower_back", "trunk_front", "arm", "hip", "thigh", "knee", "lower_leg", "ankle_foot"]

# Keyword → region. First match wins; position decides the rest.
KEYWORD_REGION: list[tuple[str, str]] = [
    # spine by level (explicit vertebra names first)
    (r"vertebra c\d|\bc[1-7]\b", "neck"),
    (r"vertebra t\d", "upper_back"),
    (r"vertebra l\d", "lower_back"),
    (r"interscapular|infrascapular|scapular region|vertebral region|triangle of auscultation", "upper_back"),
    (r"anal region|urogenital|perine|gluteal fold", "hip"),
    (r"\b(atlas|axis)\b|\(c[1-7]\)|cervical vertebra|disc c\d|vertebra prominens", "neck"),
    (r"\(t\d{1,2}\)|thoracic vertebra|disc t\d", "upper_back"),
    (r"\(l[1-5]\)|lumbar vertebra|disc l\d|sacrum|coccyx|sacral|lumbar|iliolumbar|quadratus lumborum|multifidus lumborum|sacro-?iliac|lumbosacral|lumborum|thoracolumbar", "lower_back"),
    # neck / head
    (r"sternocleidomastoid|scalen|splenius|levator scapulae|longus colli|longus capitis|suboccipital|rectus capitis|obliquus capitis|"
     r"semispinalis capitis|semispinalis cervicis|platysma|hyoid|digastric|omohyoid|sternothyroid|thyrohyoid|mylohyoid|"
     r"descending part of trapezius|neck|nuchal|cervical", "neck"),
    (r"cran|skull|frontal bone|parietal|occipital bone|temporal bone|temporalis|masseter|pterygoid|mandib|maxill|zygomat|nasal|"
     r"sphenoid|ethmoid|vomer|lacrimal|buccinator|orbicularis|frontalis|occipitofrontalis|mentalis|risorius|"
     r"facial|scalp|ophthalmic|trigeminal|eyebrow|buccal|auric|mastoid|parotid|orbital|\boral\b|\blabial|\blips?\b|\bchin\b|cheek|forehead", "head"),
    # shoulder girdle
    (r"clavic|scapul|acromi|coracoid|glenoid|deltoid|supraspinatus|infraspinatus|teres minor|subscapularis|teres major|"
     r"shoulder|axillary nerve|suprascapular|glenohumeral|axilla", "shoulder"),
    # arm, elbow, forearm, hand
    (r"humer|radius|ulna|carpal|scaphoid|lunate|triquetr|pisiform|trapezi(um|oid) bone|capitate|hamate|metacarp|of hand|"
     r"finger|thumb|pollicis|digiti minimi muscle of hand|biceps brachii|triceps|brachialis|coracobrachialis|anconeus|"
     r"brachioradialis|pronator|supinator|carpi|palmaris|flexor digitorum superficialis|flexor digitorum profundus|"
     r"extensor digitorum muscle$|extensor indicis|lumbrical muscles of hand|interosse(i|ous) of hand|palmar inteross|dorsal interossei of hand|"
     r"thenar|hypothenar|brachial|antebrachial|cubital|elbow|forearm|wrist|palm|median nerve|ulnar nerve|radial nerve|musculocutaneous", "arm"),
    # trunk front
    (r"stern|rib|costal|pectoral|serratus anterior|intercostal|rectus abdominis|oblique|transversus abdominis|pyramidalis|"
     r"diaphragm|abdom|umbilic|epigastr|hypochondr|inguinal|mammar|thorac(ic)? wall|presternal", "trunk_front"),
    # back
    (r"trapezius|rhomboid|latissimus|serratus posterior|interscapular|infrascapular|scapular region|vertebral region|"
     r"iliocostalis|longissimus|spinalis|semispinalis thoracis|rotatores|interspinal|intertransvers|levatores costarum|"
     r"multifidus|erector spinae|thoracodorsal|dorsal scapular|long thoracic", "back"),
    # hip & pelvis
    (r"hip bone|ilium|ischi|pubi|acetabul|glute|piriformis|obturator|gemell|quadratus femoris|tensor fasciae latae|"
     r"iliacus|psoas|iliopsoas|hip|pelvi|sciatic nerve|superior gluteal|pudendal|lumbar plexus|sacral plexus|femoral nerve", "hip"),
    # thigh
    (r"femur|femoral|rectus femoris|vastus|quadriceps|biceps femoris|semitendinosus|semimembranosus|hamstring|"
     r"adductor|sartorius|gracilis|pectineus|thigh|saphenous nerve|obturator nerve|lateral femoral cutaneous", "thigh"),
    # knee
    (r"patell|menisc|cruciate|collateral ligament of knee|popliteus|knee|genicular|popliteal", "knee"),
    # lower leg
    (r"tibia|fibula|gastrocnemius|soleus|plantaris|tibialis|fibularis|peroneus|flexor digitorum longus|"
     r"extensor digitorum longus|flexor hallucis longus|extensor hallucis longus|calf|crural|of leg|common fibular nerve|"
     r"deep fibular nerve|superficial fibular nerve|tibial nerve|sural", "lower_leg"),
    # ankle & foot
    (r"talus|talo|calcane|navicular|cuboid|cuneiform|metatars|of foot|toe|hallucis brevis|abductor hallucis|"
     r"adductor hallucis|digiti minimi of foot|plantar|heel|ankle|malleol|tarsal|dorsum of foot|sole|achilles", "ankle_foot"),
]
KEYWORD_RE = [(re.compile(p, re.I), r) for p, r in KEYWORD_REGION]


def base_name(name: str) -> tuple[str, str]:
    """'Soleus muscle.l' → ('Soleus muscle', 'left')."""
    m = re.match(r"^(.*)\.([a-z])$", name.strip())
    if not m:
        return name.strip(), "middle"
    return m.group(1).strip(), {"l": "left", "r": "right"}.get(m.group(2), "helper")


def centroid(obj) -> Vector:
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(pts, Vector()) / 8


def selected(layer: str, obj) -> bool:
    if obj.type not in ("MESH", "CURVE"):
        return False
    base, side = base_name(obj.name)
    if side == "helper":
        return False
    if SKIP_ALL.search(base) or SEX_SPECIFIC.search(base):
        return False
    if layer == "nerves":
        return bool(NERVE_KEEP.search(base)) and not NERVE_SKIP.search(base)
    if layer == "joints":
        return bool(JOINT_KEEP.search(base))
    return True


def main() -> None:
    scene = bpy.context.scene
    # Make every collection and object visible so the depsgraph evaluates them.
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = False
        lc.hide_viewport = False
    for col in bpy.data.collections:
        col.hide_viewport = False
        col.hide_render = False

    picked: dict[str, list] = {}
    for layer, cname in LAYERS.items():
        col = bpy.data.collections[cname]
        objs = [o for o in col.all_objects if selected(layer, o)]
        for o in objs:
            o.hide_viewport = False
            o.hide_render = False
            try:
                o.hide_set(False)
            except RuntimeError:
                pass
        picked[layer] = objs
        print(f"[select] {layer}: {len(objs)} objects")
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    # Body frame from the skeleton: height, facing direction.
    bone_pts = [o.matrix_world @ Vector(c) for o in picked["skeleton"] for c in o.bound_box]
    zmin = min(p.z for p in bone_pts)
    zmax = max(p.z for p in bone_pts)
    H = zmax - zmin
    nose = bpy.data.objects.get("Nasal bone.l") or bpy.data.objects.get("Nasal bone.r")
    occ = bpy.data.objects.get("Occipital bone")
    front = -1.0 if (nose and occ and centroid(nose).y < centroid(occ).y) else 1.0  # sign of +y that points to the front
    print(f"[frame] height={H:.3f} zmin={zmin:.3f} front=+y*{front}")

    def region_of(base: str, c: Vector) -> str:
        h = (c.z - zmin) / H
        for rx, reg in KEYWORD_RE:
            if rx.search(base):
                if reg == "back":  # long back muscles: decide by height (lumbar spine starts ~0.64 H)
                    return "lower_back" if h < 0.64 else "upper_back"
                return reg
        ax = abs(c.x) / H
        anterior = (c.y * front) > 0.0
        if h > 0.87:
            return "head"
        if h > 0.82:
            return "neck"
        if ax > 0.1 and h > 0.45:
            return "shoulder" if h > 0.74 else "arm"
        if h > 0.66:
            return "trunk_front" if anterior else "upper_back"
        if h > 0.55:
            return "trunk_front" if anterior else "lower_back"
        if h > 0.47:
            return "hip"
        if h > 0.31:
            return "thigh"
        if h > 0.235:
            return "knee"
        if h > 0.06:
            return "lower_leg"
        return "ankle_foot"

    # Baked copies go into one fresh collection per layer, in this scene.
    root = scene.collection
    manifest: dict[str, dict] = {}
    stats = defaultdict(Counter)
    # Hide every original so only the baked copies are exported.
    orig_names = {o.name for o in scene.objects}

    for layer, objs in picked.items():
        coll = bpy.data.collections.new(f"export_{layer}")
        root.children.link(coll)
        built = []
        for o in objs:
            ev = o.evaluated_get(dg)
            try:
                me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
            except RuntimeError:
                continue
            if me is None or len(me.polygons) == 0:
                continue
            me.transform(o.matrix_world)
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.triangulate(bm, faces=bm.faces[:])
            bm.to_mesh(me)
            bm.free()
            while me.uv_layers:
                me.uv_layers.remove(me.uv_layers[0])
            base, side = base_name(o.name)
            c = sum((v.co for v in me.vertices), Vector()) / max(1, len(me.vertices))
            reg = region_of(base, c)
            new = bpy.data.objects.new(o.name + "#x", me)
            new["zname"] = o.name
            new["label"] = base
            new["side"] = side
            new["layer"] = layer
            new["region"] = reg
            coll.objects.link(new)
            built.append(new)
            stats[layer][reg] += 1
            manifest[o.name] = {"label": base, "side": side, "layer": layer, "region": reg,
                                "c": [round(c.x, 4), round(c.z, 4), round(-c.y, 4)]}  # glTF is Y-up: (x, z, -y)

        total = sum(len(b.data.polygons) for b in built)
        ratio = min(1.0, BUDGET[layer] / max(1, total))
        print(f"[decimate] {layer}: {len(built)} meshes, {total} tris -> ratio {ratio:.3f}")
        if ratio < 1.0:
            for b in built:
                n = len(b.data.polygons)
                r = max(ratio, min(1.0, MIN_TRIS / max(1, n)))
                if r < 0.999:
                    mod = b.modifiers.new("dec", "DECIMATE")
                    mod.ratio = r
            bpy.context.view_layer.update()
            dg2 = bpy.context.evaluated_depsgraph_get()
            for b in built:
                if not b.modifiers:
                    continue
                me2 = bpy.data.meshes.new_from_object(b.evaluated_get(dg2), preserve_all_data_layers=False, depsgraph=dg2)
                old = b.data
                b.modifiers.clear()
                b.data = me2
                bpy.data.meshes.remove(old)
        final = sum(len(b.data.polygons) for b in built)
        print(f"[decimate] {layer}: final {final} tris")

        # Export only this collection: make it the active collection.
        lc = next(l for l in bpy.context.view_layer.layer_collection.children if l.collection == coll)
        bpy.context.view_layer.active_layer_collection = lc
        path = OUT / f"{layer}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLB",
            use_active_collection=True,
            use_active_collection_with_nested=False,
            use_visible=False,
            export_extras=True,
            export_apply=False,
            export_yup=True,
            export_materials="NONE",
            export_texcoords=False,
            export_normals=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=7,
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
        )
        print(f"[export] {path} {path.stat().st_size / 1e6:.2f} MB")

    MANIFEST_OUT.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_OUT.write_text(json.dumps({
        "credit": "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0; derived from BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan",
        "height": round(H, 4), "zmin": round(zmin, 4),
        "regions": REGIONS,
        "structures": manifest,
    }, ensure_ascii=False))
    print("[manifest]", MANIFEST_OUT, len(manifest), "structures")
    for layer, cnt in stats.items():
        print(f"[regions] {layer}: {dict(cnt)}")


main()
