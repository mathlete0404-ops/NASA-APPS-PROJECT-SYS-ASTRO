// "Where does it come from?" — candidate pain sources per region.
// Pain is often felt away from its source (referred pain): a disc or nerve root in the
// back can hurt in the leg, the neck can hurt in the shoulder or arm, the hip can hurt in
// the knee. Each source lists the 3D structures to light up and a few yes/no questions.
// Scoring is fixed arithmetic (rules, not AI) and the result is a *pattern*, never a diagnosis.
// redFlag questions route to the crew medical officer through the triage engine.
import type { Region } from '../engine/triage'

export type SourceKind = 'muscle' | 'joint' | 'disc' | 'nerve' | 'bone' | 'other'
export interface SourceQuestion { id: string; q: string; weight: number; redFlag?: 'spreading_tingling' | 'bony_tender' | 'cannot_bear_weight' | 'swelling' }
export interface PainSource {
  id: string
  label: string
  kind: SourceKind
  /** Structures to highlight on the 3D body (matched against Z-Anatomy labels). */
  match: RegExp
  /** Where the source is, if not in the painful region itself (referred pain). */
  from?: Region
  why: string
  space?: string
  questions: SourceQuestion[]
}

export const KIND_LABEL: Record<SourceKind, string> = {
  muscle: 'Muscle', joint: 'Joint', disc: 'Disc', nerve: 'Nerve (referred)', bone: 'Bone', other: 'Other',
}

const nerveTingle = (id: string, where: string): SourceQuestion => ({ id, q: `Tingling, pins-and-needles or numbness ${where}?`, weight: 3, redFlag: 'spreading_tingling' })

export const SOURCES: Partial<Record<Region, PainSource[]>> = {
  lower_back: [
    { id: 'lb-muscle', label: 'Deep back muscles (multifidus, erector spinae)', kind: 'muscle', match: /multifidus lumborum|iliocostalis lumborum|quadratus lumborum|longissimus thoracis|interspinales lumborum/i,
      why: 'Local aching from muscles beside the spine.', space: 'These muscles shrink in weightlessness because they no longer hold you upright.',
      questions: [{ id: 'press', q: 'Does pressing the muscle just beside the spine reproduce the pain?', weight: 2 }, { id: 'posture', q: 'Worse after holding one posture, better once you move?', weight: 1 }] },
    { id: 'lb-disc', label: 'Lumbar disc (L4–L5 / L5–S1)', kind: 'disc', match: /intervertebral disc l4-l5|intervertebral disc l5-s1|intervertebral disc l3-l4/i,
      why: 'Discs can strain or bulge, giving deep central back pain.', space: 'Discs swell in microgravity; disc herniation is more common after flight.',
      questions: [{ id: 'flex', q: 'Worse when bending forward, sitting, coughing or sneezing?', weight: 2 }, { id: 'load', q: 'Started after lifting or a heavy loaded exercise?', weight: 1 }] },
    { id: 'lb-nerve', label: 'Nerve root → sciatic nerve', kind: 'nerve', match: /sciatic nerve|lumbar nerves|sacral plexus|lumbosacral plexus|tibial nerve|common fibular nerve/i,
      why: 'An irritated nerve root sends pain down the leg along the sciatic nerve.',
      questions: [{ id: 'below-knee', q: 'Does pain travel down the leg below the knee?', weight: 3 }, nerveTingle('tingle', 'in the leg or foot')] },
    { id: 'lb-si', label: 'Sacro-iliac joint', kind: 'joint', match: /sacro-iliac|sacrum/i,
      why: 'One-sided pain at the base of the spine can come from the joint between sacrum and pelvis.',
      questions: [{ id: 'dimple', q: 'One-sided, right over the dimple at the base of the spine?', weight: 2 }, { id: 'one-leg', q: 'Does standing on that leg (with gravity) hurt there?', weight: 1 }] },
  ],
  thigh: [
    { id: 'th-muscle', label: 'Thigh muscle (quadriceps / hamstrings / adductors)', kind: 'muscle', match: /rectus femoris|vastus|semitendinosus|semimembranosus|biceps femoris|adductor|gracilis|sartorius/i,
      why: 'Strain of a thigh muscle, often after exercise.', questions: [{ id: 'press', q: 'Does pressing the muscle belly reproduce it?', weight: 2 }, { id: 'resist', q: 'Hurts when you tighten that muscle against resistance?', weight: 2 }] },
    { id: 'th-sciatic', label: 'Sciatic nerve from the lower back', kind: 'nerve', from: 'lower_back', match: /sciatic nerve|intervertebral disc l5-s1|intervertebral disc l4-l5|sacral plexus/i,
      why: 'Back-of-thigh pain can be referred from an L5/S1 nerve root.', questions: [{ id: 'back', q: 'Do you also have lower-back pain, or does bending forward bring it on?', weight: 2 }, nerveTingle('tingle', 'down the back of the leg')] },
    { id: 'th-femoral', label: 'Femoral nerve from the upper lumbar spine', kind: 'nerve', from: 'lower_back', match: /femoral nerve|lumbar plexus|saphenous nerve|intervertebral disc l2-l3|intervertebral disc l3-l4/i,
      why: 'Front-of-thigh pain can be referred from L2–L4 along the femoral nerve.', questions: [{ id: 'front', q: 'Is it on the front of the thigh, with a burning or electric feel?', weight: 2 }, nerveTingle('tingle2', 'on the front of the thigh')] },
    { id: 'th-femur', label: 'Femur (bone stress)', kind: 'bone', match: /^femur$/i,
      why: 'Deep, dull, constant bone pain — treated cautiously because of bone loss in space.', space: 'Weight-bearing bone loses ~1%/month in microgravity.',
      questions: [{ id: 'night', q: 'Deep, constant ache that is also there at rest or at night?', weight: 2 }, { id: 'bony', q: 'Sharp pain when you press on one spot of the bone?', weight: 3, redFlag: 'bony_tender' }] },
  ],
  knee: [
    { id: 'kn-pf', label: 'Kneecap joint (patellofemoral)', kind: 'joint', match: /patella|rectus femoris|vastus medialis/i,
      why: 'Front-of-knee pain from the kneecap when the quadriceps are weak.', space: 'Thigh muscles weaken in flight; the kneecap tracks less well when reloaded.',
      questions: [{ id: 'stairs', q: 'Worse squatting, kneeling or on stairs?', weight: 2 }, { id: 'front', q: 'Pain around or behind the kneecap?', weight: 1 }] },
    { id: 'kn-menisc', label: 'Meniscus / ligaments', kind: 'joint', match: /meniscus|cruciate|articular capsule of knee/i,
      why: 'Twisting injuries can strain the cartilage or ligaments inside the knee.',
      questions: [{ id: 'twist', q: 'Did it start with a twist, or does it lock or give way?', weight: 3 }, { id: 'swell', q: 'Is the knee swollen?', weight: 2, redFlag: 'swelling' }] },
    { id: 'kn-hip', label: 'Referred from the hip joint', kind: 'joint', from: 'hip', match: /articular capsule of hip|obturator nerve|hip bone/i,
      why: 'Hip-joint problems often hurt in the knee (shared obturator / femoral nerve supply).',
      questions: [{ id: 'hip-rot', q: 'Does turning the hip inward (knee bent) hurt in the groin?', weight: 3 }, { id: 'groin', q: 'Any groin or front-of-hip ache too?', weight: 1 }] },
  ],
  lower_leg: [
    { id: 'll-calf', label: 'Calf muscles (soleus / gastrocnemius)', kind: 'muscle', match: /soleus|gastrocnemius|plantaris/i,
      why: 'Calf strain or cramp.', space: 'The soleus is one of the muscles that shrinks most in flight.',
      questions: [{ id: 'press', q: 'Tender when you squeeze the calf muscle?', weight: 2 }, { id: 'toes', q: 'Hurts pushing the foot down against resistance?', weight: 2 }] },
    { id: 'll-tibia', label: 'Tibia (bone stress)', kind: 'bone', match: /^tibia$|^fibula$/i,
      why: 'Shin pain on one spot of the bone can be a stress reaction.', space: 'Reloading weakened bone after landing raises stress-injury risk.',
      questions: [{ id: 'bony', q: 'Sharp pain pressing one spot on the shin bone?', weight: 3, redFlag: 'bony_tender' }, { id: 'load', q: 'Worse with each step or hop?', weight: 1 }] },
    { id: 'll-nerve', label: 'S1 nerve root → tibial / sural nerve', kind: 'nerve', from: 'lower_back', match: /tibial nerve|sural nerve|sciatic nerve|intervertebral disc l5-s1/i,
      why: 'Calf or outer-leg pain can be referred from the S1 nerve root.', questions: [{ id: 'back', q: 'Lower-back pain as well?', weight: 2 }, nerveTingle('tingle', 'in the calf, outer foot or sole')] },
    { id: 'll-clot', label: 'Vein (clot) — medical officer check', kind: 'other', match: /soleus|gastrocnemius/i,
      why: 'A swollen, warm, tender calf can be a blood clot. Clots have been found in astronauts’ neck veins during flight.',
      questions: [{ id: 'swell', q: 'Is one calf swollen, warm or red compared with the other?', weight: 4, redFlag: 'swelling' }] },
  ],
  ankle_foot: [
    { id: 'af-lig', label: 'Ankle ligaments', kind: 'joint', match: /anterior talofibular|calcaneofibular|talus/i,
      why: 'A rolled ankle sprains the outer ligaments.', space: 'After landing, poor balance makes ankle rolls more likely.',
      questions: [{ id: 'roll', q: 'Did it start by rolling or twisting the ankle?', weight: 3 }, { id: 'weight', q: 'Can you NOT take 4 steps on it?', weight: 3, redFlag: 'cannot_bear_weight' }] },
    { id: 'af-achilles', label: 'Achilles / calf tendon', kind: 'muscle', match: /soleus|gastrocnemius|calcane/i,
      why: 'Back-of-heel pain from the Achilles tendon when the calf is weak or tight.', questions: [{ id: 'morning', q: 'Stiff and sore at the back of the heel first thing?', weight: 2 }] },
    { id: 'af-plantar', label: 'Sole of the foot', kind: 'muscle', match: /plantar|abductor hallucis|flexor digitorum brevis|calcaneus/i,
      why: 'Heel or arch pain from the plantar tissues.', space: 'The soles lose their thick skin in flight and are sensitive when reloaded.',
      questions: [{ id: 'first-steps', q: 'Worst on the first steps after rest?', weight: 2 }] },
    { id: 'af-nerve', label: 'L5 / S1 nerve root', kind: 'nerve', from: 'lower_back', match: /deep fibular nerve|superficial fibular nerve|medial plantar nerve|lateral plantar nerve|sciatic nerve/i,
      why: 'Numb or burning foot can come from a nerve root in the lower back.', questions: [nerveTingle('tingle', 'on top of the foot or the sole')] },
  ],
  hip: [
    { id: 'hp-glute', label: 'Gluteal muscles', kind: 'muscle', match: /gluteus medius|gluteus minimus|gluteus maximus|tensor fasciae latae/i,
      why: 'Side-of-hip pain from the gluteal muscles or their tendons.', questions: [{ id: 'side', q: 'Tender on the outside of the hip, worse lying on that side?', weight: 2 }] },
    { id: 'hp-joint', label: 'Hip joint', kind: 'joint', match: /articular capsule of hip|hip bone|femur/i,
      why: 'Groin pain from the hip joint itself.', space: 'The hip is a weight-bearing bone that loses mineral in flight.',
      questions: [{ id: 'groin', q: 'Pain deep in the groin, worse turning the hip inward?', weight: 3 }, { id: 'bony', q: 'Sharp pain on one bony spot, or after a knock?', weight: 3, redFlag: 'bony_tender' }] },
    { id: 'hp-piri', label: 'Piriformis → sciatic nerve', kind: 'nerve', match: /piriformis|sciatic nerve|superior gluteal nerve/i,
      why: 'A tight piriformis muscle can squeeze the sciatic nerve in the buttock.', questions: [{ id: 'buttock', q: 'Deep buttock pain, worse sitting?', weight: 2 }, nerveTingle('tingle', 'down the leg')] },
    { id: 'hp-back', label: 'Referred from the lower back / SI joint', kind: 'joint', from: 'lower_back', match: /sacro-iliac|intervertebral disc l1-l2|intervertebral disc l2-l3|lumbar plexus/i,
      why: 'Upper lumbar and sacro-iliac problems refer pain into the buttock and hip.', questions: [{ id: 'back', q: 'Lower-back pain as well?', weight: 2 }] },
  ],
  neck: [
    { id: 'nk-muscle', label: 'Neck & upper trapezius muscles', kind: 'muscle', match: /descending part of trapezius|levator scapulae|splenius|semispinalis colli|sternocleidomastoid/i,
      why: 'Muscle tension from holding the head in a forward posture.', space: 'In weightlessness the head drifts forward and down (neutral body posture).',
      questions: [{ id: 'press', q: 'Does pressing the muscle reproduce it?', weight: 2 }, { id: 'screen', q: 'Worse after long screen or workstation time?', weight: 1 }] },
    { id: 'nk-facet', label: 'Neck joints / discs (C5–C7)', kind: 'disc', match: /intervertebral disc c5-c6|intervertebral disc c6-c7|vertebra c5|vertebra c6|vertebra c7/i,
      why: 'Deep, central or one-sided neck pain from joints or discs.', questions: [{ id: 'turn', q: 'Sharp when looking up or turning to one side?', weight: 2 }] },
    { id: 'nk-root', label: 'Nerve root → arm', kind: 'nerve', match: /brachial plexus|roots of brachial plexus|median nerve|ulnar nerve|radial nerve/i,
      why: 'A neck nerve root can send pain or tingling down the arm.', questions: [{ id: 'arm', q: 'Does pain travel into the arm or hand?', weight: 3 }, nerveTingle('tingle', 'in the arm or fingers')] },
  ],
  shoulder: [
    { id: 'sh-cuff', label: 'Rotator cuff (supraspinatus …)', kind: 'muscle', match: /supraspinatus|infraspinatus|teres minor|subscapularis/i,
      why: 'Cuff tendon irritation from repeated pulling and overhead work.', space: 'Moving by handrails makes the shoulders do the work legs do on Earth; spacesuit work loads them too.',
      questions: [{ id: 'arc', q: 'Painful when lifting the arm out to the side between about 60° and 120°?', weight: 3 }, { id: 'night', q: 'Worse lying on that shoulder?', weight: 1 }] },
    { id: 'sh-joint', label: 'Shoulder joint & capsule', kind: 'joint', match: /articular capsule of glenohumeral|scapula|clavicle/i,
      why: 'Stiff, deep shoulder pain from the joint capsule.', questions: [{ id: 'stiff', q: 'Stiff in all directions, even when someone else moves the arm?', weight: 2 }] },
    { id: 'sh-neck', label: 'Referred from the neck (C5)', kind: 'nerve', from: 'neck', match: /intervertebral disc c4-c5|intervertebral disc c5-c6|suprascapular nerve|axillary nerve|superior trunk of brachial plexus/i,
      why: 'Top-of-shoulder pain is often referred from the neck.', questions: [{ id: 'neck-move', q: 'Does moving the neck change the shoulder pain?', weight: 3 }, nerveTingle('tingle', 'in the arm')] },
  ],
  arm: [
    { id: 'ar-tendon', label: 'Forearm / elbow tendons', kind: 'muscle', match: /extensor carpi|flexor carpi|brachioradialis|biceps brachii|triceps|extensor digitorum|flexor digitorum superficialis/i,
      why: 'Overuse of the gripping muscles irritates their tendons at the elbow.', space: 'Handrail translation and tool work mean a lot of gripping.',
      questions: [{ id: 'grip', q: 'Hurts when gripping or lifting with the palm down?', weight: 2 }, { id: 'press', q: 'Tender on the bony bump at the elbow?', weight: 1 }] },
    { id: 'ar-median', label: 'Median nerve (wrist / carpal tunnel)', kind: 'nerve', match: /median nerve/i,
      why: 'Squeezed median nerve gives tingling in thumb to ring finger.', questions: [nerveTingle('tingle', 'in the thumb, index or middle finger')] },
    { id: 'ar-ulnar', label: 'Ulnar nerve (elbow)', kind: 'nerve', match: /ulnar nerve/i,
      why: 'Leaning on the elbow can irritate the ulnar nerve: little-finger tingling.', questions: [nerveTingle('tingle-u', 'in the little and ring finger')] },
    { id: 'ar-neck', label: 'Referred from the neck (C6–C8)', kind: 'nerve', from: 'neck', match: /intervertebral disc c5-c6|intervertebral disc c6-c7|intervertebral disc c7-t1|roots of brachial plexus|middle trunk of brachial plexus|inferior trunk of brachial plexus/i,
      why: 'Neck nerve roots can refer pain into the arm.', questions: [{ id: 'neck', q: 'Neck pain too, or does turning the head change it?', weight: 3 }] },
  ],
  upper_back: [
    { id: 'ub-muscle', label: 'Muscles between the shoulder blades', kind: 'muscle', match: /rhomboid|transverse part of trapezius|ascending part of trapezius|spinalis thoracis|longissimus thoracis|multifidus thoracis/i,
      why: 'Postural muscle fatigue.', space: 'Rounded floating posture keeps these muscles stretched and working.',
      questions: [{ id: 'press', q: 'Tender when pressing between the shoulder blades?', weight: 2 }] },
    { id: 'ub-rib', label: 'Rib–spine joints', kind: 'joint', match: /vertebra t\d|intervertebral disc t\d/i,
      why: 'Sharp, one-sided pain on deep breath or twisting from a rib joint.', questions: [{ id: 'breath', q: 'Sharp on a deep breath or when twisting?', weight: 2 }] },
    { id: 'ub-neck', label: 'Referred from the neck', kind: 'disc', from: 'neck', match: /intervertebral disc c5-c6|intervertebral disc c6-c7|intervertebral disc c7-t1/i,
      why: 'Lower neck discs commonly refer pain to the shoulder-blade area.', questions: [{ id: 'neck', q: 'Does moving the neck change it?', weight: 2 }] },
  ],
  head: [
    { id: 'hd-fluid', label: 'Fluid shift / cabin CO₂', kind: 'other', match: /cranium|frontal|parietal/i,
      why: 'Headward fluid shift and higher CO₂ cause dull, pressure-type headaches.', space: 'About 2 L of fluid moves toward the head in weightlessness; CO₂ pockets form without convection.',
      questions: [{ id: 'puffy', q: 'Face feels puffy or nose stuffy?', weight: 2 }, { id: 'module', q: 'Better after moving to a well-ventilated module?', weight: 2 }] },
    { id: 'hd-neck', label: 'Referred from the neck (cervicogenic)', kind: 'muscle', from: 'neck', match: /splenius capitis|semispinalis capitis|descending part of trapezius|sternocleidomastoid|atlas|axis/i,
      why: 'Neck muscles and upper neck joints refer pain to the back of the head and temples.', questions: [{ id: 'neck', q: 'Starts at the back of the head or neck, worse with neck posture?', weight: 3 }] },
    { id: 'hd-jaw', label: 'Jaw muscles', kind: 'muscle', match: /masseter|temporalis|articular disc of temporomandibular/i,
      why: 'Clenching the jaw (stress, sleep) causes temple and jaw-side headaches.', questions: [{ id: 'jaw', q: 'Sore jaw, or temples tender to press?', weight: 2 }] },
  ],
}

export interface SourceScore { source: PainSource; score: number; max: number; reasons: string[] }

/** Deterministic scoring: sum of weights of "yes" answers; ties keep list order. */
export function scoreSources(region: Region, answers: Record<string, boolean | undefined>): SourceScore[] {
  return (SOURCES[region] ?? []).map((source) => {
    let score = 0
    const reasons: string[] = []
    for (const q of source.questions) {
      if (answers[`${source.id}:${q.id}`]) { score += q.weight; reasons.push(q.q.replace(/\?$/, '') + ` (+${q.weight})`) }
    }
    return { source, score, max: source.questions.reduce((a, q) => a + q.weight, 0), reasons }
  }).sort((a, b) => b.score - a.score)
}

/** Red-flag answers become triage test inputs (e.g. spreading tingling → nerve pattern). */
export function redFlagsFrom(region: Region, answers: Record<string, boolean | undefined>) {
  const flags: Record<string, boolean> = {}
  for (const s of SOURCES[region] ?? []) for (const q of s.questions) if (q.redFlag && answers[`${s.id}:${q.id}`]) flags[q.redFlag] = true
  return flags
}
