// "Why does it hurt?" cards — three parts: what space is doing → what your test showed
// (filled in from the triage result) → what helps. Educational patterns, not diagnoses.
import type { Region } from '../engine/triage'

export interface WhyCard {
  region: Region
  title: string
  space: string[]
  helps: string[]
  evidence: string[] // keys of EVIDENCE
  exercises: string[] // keys of EXERCISES
}

export const CARDS: Partial<Record<Region, WhyCard>> = {
  lower_back: {
    region: 'lower_back',
    title: 'Lower back',
    space: [
      'Without gravity the discs between your vertebrae soak up fluid and the spine lengthens by several centimetres.',
      'The deep back muscles (multifidus, erector spinae) are barely used while floating and shrink over a long flight.',
      'Back pain in the first days of flight is one of the most common crew complaints; disc problems are more frequent after flight.',
    ],
    helps: [
      'Knees-to-chest “fetal tuck” — crews report it relieves early-flight back pain by compressing the spine.',
      'Gentle core and spine control: cat-cow, bird-dog, dead bug.',
      'Do your loaded exercise sessions (squat, deadlift on the resistive device) — they protect the spine muscles.',
    ],
    evidence: ['spine', 'paraspinal', 'nlsp'],
    exercises: ['fetal_tuck', 'cat_cow', 'bird_dog', 'dead_bug'],
  },
  upper_back: {
    region: 'upper_back',
    title: 'Upper back',
    space: [
      'Floating, the body drifts into a “neutral body posture”: shoulders forward, arms raised, upper back rounded.',
      'Long hours at a workstation or holding handrails keep the same muscles working without rest.',
    ],
    helps: ['Shoulder-blade squeezes and thoracic extension over a foot restraint.', 'Change posture every 30–45 minutes.'],
    evidence: ['nlsp'],
    exercises: ['scap_squeeze', 'cat_cow'],
  },
  neck: {
    region: 'neck',
    title: 'Neck',
    space: [
      'In weightlessness the head tends to drift forward and down (neutral body posture), straining the back of the neck.',
      'Fluid shifts toward the head and the cervical spine also lengthens.',
    ],
    helps: ['Chin tucks, slow side tilts and turns.', 'Raise screens to eye level; rest the head against a support while sleeping.'],
    evidence: ['spine', 'nlsp'],
    exercises: ['chin_tuck', 'side_tilt'],
  },
  shoulder: {
    region: 'shoulder',
    title: 'Shoulder',
    space: [
      'You move by pulling yourself along handrails — the shoulders do the work the legs do on Earth.',
      'Spacesuit training and EVAs load the shoulder at awkward angles; shoulder strain is a known spacesuit injury.',
    ],
    helps: ['Pendulum swings and band external rotation, pain-free range only.', 'Shoulder-blade squeezes to balance the pulling work.'],
    evidence: ['nlsp'],
    exercises: ['pendulum', 'scap_squeeze'],
  },
  hip: {
    region: 'hip',
    title: 'Hip',
    space: [
      'The hip is a weight-bearing bone: without countermeasures it can lose about 1–1.5% of its mineral each month in flight.',
      'That is why Crew Mirror treats bony hip pain more cautiously the longer you have been in microgravity.',
    ],
    helps: ['Glute bridges and side-lying leg raises.', 'Meet your protein, calcium and vitamin D targets; do the loaded sessions.'],
    evidence: ['nutrition', 'nlsp'],
    exercises: ['glute_bridge', 'squat'],
  },
  knee: {
    region: 'knee',
    title: 'Knee',
    space: [
      'Thigh muscles (quadriceps) weaken when the legs are not carrying the body; the knee loses its usual support.',
      'After landing, the knee is suddenly loaded again by muscles that are weaker than before flight.',
    ],
    helps: ['Partial squats and wall sits in a pain-free range.', 'Build up load gradually after landing — do not jump straight back to full activity.'],
    evidence: ['nlsp', 'walkline'],
    exercises: ['squat', 'balance_hold'],
  },
  ankle_foot: {
    region: 'ankle_foot',
    title: 'Ankle & foot',
    space: [
      'The calf (soleus) is among the muscles that shrink most in flight; the soles of the feet lose their usual pressure feedback.',
      'After landing, poor balance and weak calves make ankle twists more likely.',
    ],
    helps: ['Calf raises and a balance hold beside a handrail.', 'Take the balance test before walking unaided or an EVA.'],
    evidence: ['walkline', 'fieldtest', 'nlsp'],
    exercises: ['calf_raise', 'balance_hold'],
  },
  arm: {
    region: 'arm',
    title: 'Arm, elbow & wrist',
    space: [
      'Without legs to walk on, you move by pulling along handrails — the forearms and grip work all day.',
      'Tool work, small fasteners and spacesuit gloves load the forearm tendons at the elbow and wrist.',
      'Tingling in the hand can come from a nerve squeezed at the wrist or elbow — or from the neck.',
    ],
    helps: ['Ease grip load: alternate hands on handrails, use foot restraints at work stations.', 'Wrist extensor stretch and tendon glides, pain-free only.', 'Report any tingling or numbness — that is a nerve pattern for the crew medical officer.'],
    evidence: ['nlsp'],
    exercises: ['wrist_stretch', 'tendon_glide'],
  },
  thigh: {
    region: 'thigh',
    title: 'Thigh',
    space: [
      'Quadriceps and hamstrings lose size and strength when the legs no longer carry body weight.',
      'The femur is a weight-bearing bone that loses mineral in flight, so deep bone pain is treated cautiously.',
      'Back-of-thigh pain can be referred from a nerve root in the lower back (sciatic nerve).',
    ],
    helps: ['Quadriceps sets and gentle hamstring stretch.', 'Keep up loaded squats on the resistive device.', 'If pain travels below the knee or tingles, it is a nerve pattern: contact the crew medical officer.'],
    evidence: ['nlsp', 'nutrition'],
    exercises: ['quad_set', 'hamstring_stretch', 'squat'],
  },
  lower_leg: {
    region: 'lower_leg',
    title: 'Shin & calf',
    space: [
      'The calf (soleus) is one of the muscles that shrinks most in weightlessness.',
      'After landing, weakened bone in the shin is suddenly loaded again — sharp pain on one spot of the bone needs a check.',
      'A swollen, warm calf can be a blood clot; venous clots have been found in astronauts during flight.',
    ],
    helps: ['Ankle pumps and a gentle calf stretch.', 'Build walking and hopping up gradually after landing.', 'One-sided calf swelling or warmth → crew medical officer, no exercises.'],
    evidence: ['nlsp', 'walkline'],
    exercises: ['ankle_pump', 'calf_stretch', 'calf_raise'],
  },
  trunk_front: {
    region: 'trunk_front',
    title: 'Chest & abdomen',
    space: [
      'Chest pain is a danger sign and is always screened first.',
      'Abdominal pain can have many internal causes that self-tests cannot separate.',
    ],
    helps: ['The crew medical officer assesses chest and abdominal pain — this app does not suggest exercises for it.'],
    evidence: ['nlsp'],
    exercises: [],
  },
  head: {
    region: 'head',
    title: 'Headache & facial fullness',
    space: [
      'About two litres of body fluid shift toward the head in weightlessness: puffy face, stuffy nose and headaches are common.',
      'Higher cabin CO₂ is linked to more headaches on the ISS — CO₂ does not mix well without convection.',
      'Any sudden severe headache or vision change is a danger sign (screened first, always).',
    ],
    helps: ['Check cabin CO₂ and move to a well-ventilated module.', 'Drink to your water target, keep sleep regular.', 'Report blurred vision to the crew medical officer — it can be an early sign of eye changes in spaceflight.'],
    evidence: ['eda', 'nlsp'],
    exercises: [],
  },
}

export const REGION_LABEL: Record<Region, string> = {
  head: 'Head', neck: 'Neck', shoulder: 'Shoulder', upper_back: 'Upper back', lower_back: 'Lower back',
  trunk_front: 'Chest & abdomen', arm: 'Arm, elbow & wrist', hip: 'Hip', thigh: 'Thigh', knee: 'Knee',
  lower_leg: 'Shin & calf', ankle_foot: 'Ankle & foot', other: 'Other',
}

// Press/move tests offered per region (the body map shows where).
export const REGION_TESTS: Record<Region, { muscle: string; bone: string; resisted: string; stretch: string; rom: string } | null> = {
  head: null,
  trunk_front: null,
  arm: { muscle: 'Press the forearm muscle just below the elbow', bone: 'Press the bony bumps at the elbow and wrist', resisted: 'Lift the back of the hand against your other hand', stretch: 'Straighten the elbow and bend the wrist down', rom: 'Bend and straighten the elbow slowly' },
  thigh: { muscle: 'Press the front and back thigh muscles', bone: 'Press along the thigh bone through the muscle', resisted: 'Straighten the knee hard against resistance', stretch: 'Straight-leg raise until the back of the thigh pulls', rom: 'Lift the knee toward the chest' },
  lower_leg: { muscle: 'Squeeze the calf muscle', bone: 'Press along the front edge of the shin bone', resisted: 'Push the foot down against resistance', stretch: 'Pull the toes up toward you, knee straight', rom: 'Point and flex the foot slowly' },
  neck: { muscle: 'Press the muscle at the side/back of the neck', bone: 'Press the bony bumps down the middle of the neck', resisted: 'Push your head into your hand without moving', stretch: 'Tilt the ear toward the shoulder', rom: 'Turn the head slowly to the side' },
  shoulder: { muscle: 'Press the muscle on top of the shoulder', bone: 'Press the collarbone and the bony tip of the shoulder', resisted: 'Push your arm out against your other hand', stretch: 'Reach the arm across your chest', rom: 'Raise the straight arm forward and up' },
  upper_back: { muscle: 'Press the muscle between the shoulder blades', bone: 'Press the bony bumps down the spine', resisted: 'Squeeze the shoulder blades together hard', stretch: 'Hug yourself and round the upper back', rom: 'Twist the upper body slowly' },
  lower_back: { muscle: 'Press the muscle beside the spine', bone: 'Press the bony bumps down the middle of the spine', resisted: 'Arch the back against a foot restraint', stretch: 'Pull both knees to the chest', rom: 'Bend forward slowly from the hips' },
  hip: { muscle: 'Press the buttock and side-hip muscle', bone: 'Press the bony point at the side of the hip', resisted: 'Push the knee out against your hand', stretch: 'Cross the ankle over the other knee', rom: 'Lift the knee toward the chest' },
  knee: { muscle: 'Press the thigh muscle above the knee', bone: 'Press the kneecap and the bony edges of the joint', resisted: 'Straighten the knee against resistance', stretch: 'Pull the heel toward the buttock', rom: 'Bend the knee slowly' },
  ankle_foot: { muscle: 'Press the calf muscle', bone: 'Press the ankle bones and the base of the little toe', resisted: 'Push the foot down against resistance', stretch: 'Pull the toes up toward you', rom: 'Point and flex the foot slowly' },
  other: null,
}
