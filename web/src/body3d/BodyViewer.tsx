// Interactive 3D anatomy (Z-Anatomy, CC BY-SA 4.0) for Crew Mirror.
// - Layers: skin regions, muscles, bones, nerves, discs & ligaments (toggle + x-ray).
// - Tap any structure → onPick({zname, label, region, side, layer}); the camera flies to it.
// - Highlights: problem regions (red/amber), pain site, candidate pain sources, nerve paths.
// Loaded lazily (three.js is large) and fully offline (models + Draco decoder are local).
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { CameraControls, useGLTF, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import type { Region } from '../engine/triage'

export type Layer = 'skin' | 'muscles' | 'skeleton' | 'nerves' | 'joints'
export interface Picked { zname: string; label: string; region: Region; side: 'left' | 'right' | 'middle'; layer: Layer }
export type Tone = 'pain' | 'act' | 'watch' | 'source' | 'source-top' | 'nerve' | 'select'
/** A highlight rule: structures matching region/side and/or a label pattern get a tone. */
export interface Highlight { tone: Tone; region?: Region; side?: 'left' | 'right' | 'middle' | 'both'; match?: RegExp; layers?: Layer[] }

const BASE = import.meta.env.BASE_URL
const FILES: Record<Layer, string> = {
  skin: 'models/skin.glb', muscles: 'models/muscles.glb', skeleton: 'models/skeleton.glb',
  nerves: 'models/nerves.glb', joints: 'models/joints.glb',
}
export const LAYER_LABEL: Record<Layer, string> = { skin: 'Skin regions', muscles: 'Muscles', skeleton: 'Bones', nerves: 'Nerves', joints: 'Discs & ligaments' }

const BASE_MAT: Record<Layer, THREE.MeshStandardMaterialParameters> = {
  skin: { color: '#e3b49a', roughness: 0.75, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false },
  muscles: { color: '#b85a4c', roughness: 0.62, metalness: 0 },
  skeleton: { color: '#eee6d6', roughness: 0.78, metalness: 0 },
  nerves: { color: '#f2c94c', roughness: 0.45, emissive: '#5a4300', emissiveIntensity: 0.35 },
  joints: { color: '#9cb8d6', roughness: 0.55 },
}
// "Body" view: a smooth matte mannequin surface (no skin tone, sex-neutral).
const SOLID_SKIN: THREE.MeshStandardMaterialParameters = { color: '#c9ced8', roughness: 0.88, metalness: 0, transparent: false, opacity: 1, depthWrite: true }

export type View = 'body' | 'muscles' | 'bones' | 'nerves' | 'custom'
const VIEWS: Record<Exclude<View, 'custom'>, { label: string; layers: Layer[]; xray: number }> = {
  body: { label: 'Body', layers: ['skin'], xray: 0 },
  muscles: { label: 'Muscles', layers: ['muscles', 'skeleton'], xray: 0 },
  bones: { label: 'Bones', layers: ['skeleton', 'joints'], xray: 0 },
  nerves: { label: 'Nerves', layers: ['muscles', 'skeleton', 'nerves'], xray: 0.75 },
}

const TONE: Record<Tone, { color: string; emissive: string; intensity: number }> = {
  pain: { color: '#ef4444', emissive: '#ff1f1f', intensity: 0.85 },
  act: { color: '#ef4444', emissive: '#b91c1c', intensity: 0.55 },
  watch: { color: '#f59e0b', emissive: '#b45309', intensity: 0.5 },
  source: { color: '#a78bfa', emissive: '#6d28d9', intensity: 0.45 },
  'source-top': { color: '#8b5cf6', emissive: '#7c3aed', intensity: 0.9 },
  nerve: { color: '#fde047', emissive: '#facc15', intensity: 1.0 },
  select: { color: '#2dd4bf', emissive: '#0d9488', intensity: 0.8 },
}
const TONE_RANK: Record<Tone, number> = { select: 7, pain: 6, 'source-top': 5, nerve: 4, act: 3, source: 2, watch: 1 }

function matches(ud: Record<string, string>, h: Highlight, layer: Layer) {
  if (h.layers && !h.layers.includes(layer)) return false
  if (h.region && ud.region !== h.region) return false
  if (h.side && h.side !== 'both' && h.side !== 'middle' && ud.side !== 'middle' && ud.side !== h.side) return false
  if (h.match && !h.match.test(ud.label ?? '')) return false
  return Boolean(h.region || h.match)
}

function LayerMesh({ layer, visible, xray, highlights, selected, onPick, onHover, solidSkin }: {
  layer: Layer; visible: boolean; xray: number; highlights: Highlight[]; selected?: string; solidSkin?: boolean
  onPick?: (p: Picked, obj: THREE.Object3D, stack: Picked[]) => void; onHover?: (p: Picked | null) => void
}) {
  const { scene } = useGLTF(BASE + FILES[layer], BASE + 'draco/')
  const solid = layer === 'skin' && !!solidSkin
  const base = useMemo(() => new THREE.MeshStandardMaterial({ ...BASE_MAT[layer], ...(solid ? SOLID_SKIN : {}), side: THREE.DoubleSide }), [layer, solid])
  const toneMats = useMemo(() => {
    const m = {} as Record<Tone, THREE.MeshStandardMaterial>
    for (const t of Object.keys(TONE) as Tone[]) {
      m[t] = new THREE.MeshStandardMaterial({
        color: TONE[t].color, emissive: TONE[t].emissive, emissiveIntensity: TONE[t].intensity, roughness: 0.45,
        side: THREE.DoubleSide, transparent: layer === 'skin' && !solid, opacity: layer === 'skin' && !solid ? 0.55 : 1, depthWrite: layer !== 'skin' || solid,
      })
    }
    return m
  }, [layer, solid])

  // x-ray: fade skin and muscles so bones/nerves show through
  useEffect(() => {
    if (layer === 'muscles') {
      base.transparent = xray > 0
      base.opacity = 1 - xray * 0.85
      base.depthWrite = xray < 0.5
      base.needsUpdate = true
    }
  }, [xray, base, layer])

  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const ud = mesh.userData as Record<string, string>
      if (ud.zname && ud.zname === selected) { mesh.material = toneMats.select; return }
      let best: Tone | null = null
      for (const h of highlights) if (matches(ud, h, layer) && (!best || TONE_RANK[h.tone] > TONE_RANK[best])) best = h.tone
      mesh.material = best ? toneMats[best] : base
      mesh.renderOrder = layer === 'skin' && !solid ? 2 : 0
    })
  }, [scene, highlights, selected, base, toneMats, layer, solid])

  const toPicked = (o: THREE.Object3D): Picked | null => {
    const ud = o.userData as Record<string, string>
    if (!ud?.zname) return null
    return { zname: ud.zname, label: ud.label, region: ud.region as Region, side: ud.side as Picked['side'], layer: (ud.layer === 'skin' || ud.layer === 'muscles' || ud.layer === 'skeleton' || ud.layer === 'nerves' || ud.layer === 'joints' ? ud.layer : layer) as Layer }
  }
  const info = (e: ThreeEvent<PointerEvent | MouseEvent>): Picked | null => toPicked(e.object)
  const shown = (o: THREE.Object3D) => { for (let x: THREE.Object3D | null = o; x; x = x.parent) if (!x.visible) return false; return true }
  return (
    <primitive
      object={scene}
      visible={visible}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!onPick || e.delta > 6) return
        e.stopPropagation()
        // everything under the pointer, front to back (skin → muscle → deeper muscle → bone)
        const seen = new Set<string>()
        const stack = e.intersections.filter((i) => shown(i.object)).map((i) => toPicked(i.object)).filter((x): x is Picked => {
          if (!x || seen.has(x.zname)) return false
          seen.add(x.zname); return true
        })
        const p = info(e)
        if (p) onPick(p, e.object, stack.length ? stack : [p])
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => { if (onHover && e.pointerType === 'mouse') { e.stopPropagation(); onHover(info(e)) } }}
      onPointerOut={() => onHover?.(null)}
    />
  )
}

export interface BodyViewerProps {
  highlights?: Highlight[]
  selected?: string
  /** Layer of the selected structure (from search), so it can be loaded and shown first. */
  selectedLayer?: Layer
  onPick?: (p: Picked, stack: Picked[]) => void
  initialLayers?: Layer[]
  height?: number | string
  focus?: { region?: Region; side?: string; match?: RegExp } | null
  showControls?: boolean
  pickLayers?: Layer[]
  /** 0..1 — fade muscles so nerves, discs and bones show through. */
  initialXray?: number
  /** Start in a preset view (ignored when initialLayers is given). */
  initialView?: Exclude<View, 'custom'>
}

const POSTERIOR = new Set<Region>(['upper_back', 'lower_back'])

export function BodyViewer({
  highlights = [], selected, selectedLayer, onPick, initialLayers, height = 560, focus, showControls = true, pickLayers, initialXray, initialView = 'body',
}: BodyViewerProps) {
  const [view, setView] = useState<View>(initialLayers ? 'custom' : initialView)
  const [layers, setLayers] = useState<Set<Layer>>(new Set(initialLayers ?? VIEWS[initialView].layers))
  const [xray, setXray] = useState(initialXray ?? (initialLayers ? 0 : VIEWS[initialView].xray))
  const [showLayers, setShowLayers] = useState(false)
  // Only download a layer's model once it is first shown (the five models are ~6 MB together).
  const [loaded, setLoaded] = useState<Set<Layer>>(() => new Set(layers))
  useEffect(() => { setLoaded((cur) => ([...layers].every((l) => cur.has(l)) ? cur : new Set([...cur, ...layers]))) }, [layers])
  const pickView = (v: Exclude<View, 'custom'>) => { setView(v); setLayers(new Set(VIEWS[v].layers)); setXray(VIEWS[v].xray) }
  const [hover, setHover] = useState<Picked | null>(null)
  const controls = useRef<CameraControls>(null)
  const group = useRef<THREE.Group>(null)

  const flyTo = (obj: THREE.Object3D | null) => {
    if (!obj || !controls.current) return
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3()).length()
    const pad = Math.max(0.12, 0.6 - size)
    void controls.current.fitToBox(box.expandByScalar(pad), true, { paddingTop: 0.05, paddingBottom: 0.05 })
  }
  const reset = () => void controls.current?.setLookAt(0, 0.95, 2.6, 0, 0.9, 0, true)
  // CameraControls starts looking at the origin (the feet): aim at the body's centre as soon as it exists.
  const aimed = useRef(false)
  const controlsRef = (c: CameraControls | null) => {
    controls.current = c
    if (c && !aimed.current) { aimed.current = true; void c.setLookAt(0, 0.95, 2.6, 0, 0.9, 0, false) }
  }
  const view3 = (side: 'front' | 'back' | 'left' | 'right') => {
    const p = { front: [0, 0.95, 2.6], back: [0, 0.95, -2.6], left: [2.6, 0.95, 0], right: [-2.6, 0.95, 0] }[side]
    void controls.current?.setLookAt(p[0], p[1], p[2], 0, 0.9, 0, true)
  }

  // When a structure is chosen from search (not a click): show its layer, wait for it to load, fly to it.
  useEffect(() => {
    if (!selected) return
    const show = (lyr: Layer) => {
      if (view === 'body' && lyr !== 'skin') {
        pickView(lyr === 'muscles' ? 'muscles' : lyr === 'nerves' ? 'nerves' : 'bones')
      } else {
        setLayers((cur) => (cur.has(lyr) ? cur : new Set([...cur, lyr])))
        if ((lyr === 'skeleton' || lyr === 'joints' || lyr === 'nerves') && layers.has('muscles')) setXray((x) => Math.max(x, 0.7))
      }
    }
    if (selectedLayer) show(selectedLayer)
    let tries = 0
    let t = 0
    const tick = () => {
      let hit: THREE.Object3D | null = null
      group.current?.traverse((o) => { if (!hit && (o.userData as Record<string, string>).zname === selected) hit = o })
      if (hit) {
        if (!selectedLayer) show(((hit as THREE.Object3D).userData as Record<string, string>).layer as Layer)
        flyTo(hit)
      } else if (++tries < 50) t = window.setTimeout(tick, 200) // the layer may still be downloading
    }
    t = window.setTimeout(tick, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // Fly to a requested focus (e.g. the pain region) when it changes.
  useEffect(() => {
    if (!focus || !group.current) return
    const t = setTimeout(() => {
      const box = new THREE.Box3()
      let n = 0
      group.current!.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.visible) return
        const ud = m.userData as Record<string, string>
        const ok = (focus.region ? ud.region === focus.region : true) && (focus.match ? focus.match.test(ud.label ?? '') : true) &&
          (!focus.side || focus.side === 'both' || ud.side === 'middle' || ud.side === focus.side)
        if (ok && ud.zname) { box.expandByObject(m); n++ }
      })
      if (n && controls.current) {
        // look at back regions from behind, everything else from the front
        void controls.current.rotateTo(focus.region && POSTERIOR.has(focus.region) ? Math.PI : 0, Math.PI / 2, false)
        void controls.current.fitToBox(box.expandByScalar(0.08), true)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [focus])

  const { active, progress } = useProgress()
  const toggle = (l: Layer) => { setView('custom'); setLayers((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n }) }

  return (
    <div className="body3d" style={{ height }}>
      <Canvas camera={{ position: [0, 0.95, 2.6], fov: 35, near: 0.01, far: 20 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={['#0a0f1c']} />
        <fog attach="fog" args={['#0a0f1c', 5, 9]} />
        <hemisphereLight args={['#f1f5ff', '#1b2236', 1.05]} />
        <directionalLight position={[1.6, 3, 2.6]} intensity={1.7} color="#fff7ee" />
        <directionalLight position={[-2.4, 1.6, 1.2]} intensity={0.55} color="#c7d2fe" />
        <directionalLight position={[0, 2.2, -3]} intensity={0.9} color="#99f6e4" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.55, 48]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.28} />
        </mesh>
        <CameraControls ref={controlsRef} minDistance={0.25} maxDistance={5} makeDefault />
        <group ref={group}>
            {view === 'body' && layers.has('skin') && (
              // neutral mannequin surface where sex-specific anatomy was removed from the model
              <mesh position={[0, 0.8, -0.03]} scale={[0.07, 0.06, 0.062]}>
                <sphereGeometry args={[1, 40, 28]} />
                <meshStandardMaterial {...SOLID_SKIN} />
              </mesh>
            )}
            {(['skeleton', 'joints', 'nerves', 'muscles', 'skin'] as Layer[]).filter((l) => loaded.has(l)).map((l) => (
              // each layer has its own Suspense: loading one never blanks the others
              <Suspense key={l} fallback={null}>
                <LayerMesh
                  layer={l} visible={layers.has(l)} xray={xray} highlights={highlights} selected={selected}
                  onPick={onPick && (!pickLayers || pickLayers.includes(l)) ? (p, obj, stack) => { onPick(p, stack); flyTo(obj) } : undefined}
                  onHover={setHover}
                  solidSkin={view === 'body'}
                />
              </Suspense>
            ))}
        </group>
      </Canvas>
      {active && <div className="body3d-hover mono" style={{ left: '50%', top: '45%', transform: 'translateX(-50%)' }}>Loading 3D anatomy… {Math.round(progress)}%</div>}
      {hover && <div className="body3d-hover mono">{hover.label}{hover.side !== 'middle' ? ` · ${hover.side}` : ''}</div>}
      {showControls && (
        <>
          <div className="body3d-views">
            {(Object.keys(VIEWS) as Exclude<View, 'custom'>[]).map((v) => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => pickView(v)}>{VIEWS[v].label}</button>
            ))}
          </div>
          <div className="body3d-controls">
            {showLayers && (
              <div className="row" style={{ gap: 6 }}>
                {(Object.keys(LAYER_LABEL) as Layer[]).map((l) => (
                  <button key={l} className={`btn small${layers.has(l) ? ' sel' : ''}`} onClick={() => toggle(l)}>{LAYER_LABEL[l]}</button>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: 6 }}>
              <button className={`btn small${showLayers ? ' sel' : ''}`} onClick={() => setShowLayers((v) => !v)}>Layers</button>
              <label className="mono xray">X-ray
                <input type="range" min={0} max={1} step={0.05} value={xray} onChange={(e) => setXray(+e.target.value)} />
              </label>
              <span className="spacer" />
              {(['front', 'back', 'left', 'right'] as const).map((v) => <button key={v} className="btn small" onClick={() => view3(v)}>{v}</button>)}
              <button className="btn small" onClick={reset}>reset</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default BodyViewer
