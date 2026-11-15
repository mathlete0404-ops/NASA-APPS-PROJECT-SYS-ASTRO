// Camera mode for "where does it hurt?": touch the painful spot with one finger and hold
// still for about a second. Only the skeleton and fingertip are drawn; video never leaves.
import { cameraHelp } from './ui'
import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw } from 'lucide-react'
import { VisionSession, drawPose, type PoseFrame, type HandTip } from '../vision/camera'
import { bodySegments, locateTouch, TouchHold, type PointHit } from '../engine/pointing'
import { REGION_LABEL } from '../content/cards'
import type { Region } from '../engine/triage'

export function PointToPain({ onConfirm }: { onConfirm: (region: Region, side: 'left' | 'right' | 'middle') => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const session = useRef<VisionSession | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'live' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [hit, setHit] = useState<PointHit | null>(null)
  const [progress, setProgress] = useState(0)
  const [confirmed, setConfirmed] = useState<PointHit | null>(null)

  useEffect(() => () => session.current?.stop(), [])

  const draw = (pose: PoseFrame | null, hands: HandTip[], h: PointHit | null, prog: number) => {
    const c = canvas.current
    if (!c) return
    drawPose(c, pose)
    const g = c.getContext('2d')!
    if (pose && h) {
      // light up the touched segment
      const seg = bodySegments(pose).find((s) => s.region === h.region && s.side === h.side)
      if (seg) {
        g.strokeStyle = '#ef4444'
        g.lineWidth = 14
        g.lineCap = 'round'
        g.globalAlpha = 0.65
        g.beginPath()
        g.moveTo((1 - seg.a[0] / pose.aspect) * c.width, seg.a[1] * c.height)
        g.lineTo((1 - seg.b[0] / pose.aspect) * c.width, seg.b[1] * c.height)
        g.stroke()
        g.globalAlpha = 1
      }
    }
    for (const t of hands) {
      const x = (1 - t.tip[0]) * c.width, y = t.tip[1] * c.height
      g.fillStyle = '#facc15'
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill()
      if (h && t.tip === h.tip) {
        g.strokeStyle = '#2dd4bf'; g.lineWidth = 4
        g.beginPath(); g.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke()
      }
    }
  }

  const start = async () => {
    setPhase('loading'); setConfirmed(null); setHit(null)
    const vs = new VisionSession('point')
    session.current = vs
    const hold = new TouchHold(1200)
    vs.onResult = (r) => {
      const hands = r.hands ?? []
      const h = r.pose ? locateTouch(r.pose, hands) : null
      const st = hold.update(r.ts, h)
      draw(r.pose ?? null, hands, h, st.progress)
      setHit(h); setProgress(st.progress)
      if (st.confirmed && h) {
        vs.stop(); session.current = null
        setConfirmed(h); setPhase('done')
        onConfirm(h.region, h.side)
      }
    }
    try {
      await vs.start()
      setPhase('live')
    } catch (e) {
      vs.stop()
      setErr(String((e as Error).message ?? e)); setPhase('error')
    }
  }

  return (
    <div className="stack">
      <div className="stage" style={{ maxWidth: '100%' }}>
        <canvas ref={canvas} width={640} height={480} />
        <div className="overlay">
          {phase === 'idle' && 'Stand back so your body is in view. Touch the sore spot with one fingertip and hold still.'}
          {phase === 'loading' && 'Loading on-device pose + hand models…'}
          {phase === 'live' && (hit ? `Touching: ${REGION_LABEL[hit.region]}${hit.side !== 'middle' ? ` (${hit.side})` : ''}. Hold ${Math.round(progress * 100)}%` : 'Touch the spot that hurts with one fingertip.')}
          {phase === 'done' && confirmed && `Got it: ${REGION_LABEL[confirmed.region]}${confirmed.side !== 'middle' ? ` (${confirmed.side})` : ''}.`}
          {phase === 'error' && cameraHelp(err)}
        </div>
      </div>
      <div className="row">
        {phase !== 'live' && phase !== 'loading' && (
          <button className="btn primary" onClick={start}>{phase === 'done' ? <><RotateCcw /> Point again</> : <><Camera /> Start camera</>}</button>
        )}
        {phase === 'live' && <button className="btn" onClick={() => { session.current?.stop(); session.current = null; setPhase('idle') }}>Stop</button>}
        <small className="privacy">🔒 Stays on this device. To point at your back, turn around.</small>
      </div>
    </div>
  )
}
