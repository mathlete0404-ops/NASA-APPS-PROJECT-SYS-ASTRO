export interface Exercise {
  id: string
  name: string
  target: string
  steps: string[]
  dose: string
  stop: string
  /** How to do it while floating — or why it must wait for gravity. */
  inFlight?: string
  needsGravity?: boolean
}

export const STOP_RULES = 'Stop if pain rises 2 or more points, turns sharp, or you feel tingling or numbness. Then report again.'

export const EXERCISES: Record<string, Exercise> = {
  fetal_tuck: { id: 'fetal_tuck', name: 'Knees-to-chest (fetal tuck)', target: 'Lower back, spine', steps: ['Anchor lightly or float free.', 'Pull both knees to your chest and hug them.', 'Breathe slowly; feel the spine gently compress.'], dose: '3 × 30 s hold', stop: STOP_RULES, inFlight: 'Works floating free — anchor a toe in a foot loop if you drift.' },
  cat_cow: { id: 'cat_cow', name: 'Cat-cow', target: 'Spine mobility', steps: ['Hands and knees (feet in restraints in flight).', 'Round the back up, chin to chest.', 'Then let the belly drop and look forward.'], dose: '10 slow reps', stop: STOP_RULES, inFlight: "Feet in foot restraints, hands on a handrail; move slowly so you don't push off." },
  bird_dog: { id: 'bird_dog', name: 'Bird-dog', target: 'Multifidus, deep core', steps: ['Hands and knees.', 'Reach one arm forward and the opposite leg back.', 'Keep the hips level; hold, then switch.'], dose: '2 × 8 per side, 3 s hold', stop: STOP_RULES, inFlight: 'Anchor knees under a foot restraint strap; the balance part is easier, so focus on keeping the back still.' },
  dead_bug: { id: 'dead_bug', name: 'Dead bug', target: 'Deep abdominals', steps: ['Lie on your back, arms up, knees bent at 90°.', 'Lower one arm and the opposite leg slowly.', 'Keep the lower back pressed down.'], dose: '2 × 8 per side', stop: STOP_RULES, inFlight: 'Lie against a wall or sleep-station panel and hold a handrail behind your head.' },
  chin_tuck: { id: 'chin_tuck', name: 'Chin tuck', target: 'Deep neck flexors', steps: ['Look straight ahead.', 'Slide the chin straight back (“double chin”).', 'Hold, then relax.'], dose: '10 × 5 s', stop: STOP_RULES, inFlight: 'Same as on Earth.' },
  side_tilt: { id: 'side_tilt', name: 'Side tilt', target: 'Upper trapezius', steps: ['Sit or stand tall.', 'Tilt one ear toward the shoulder.', 'Hold a gentle stretch; switch sides.'], dose: '3 × 20 s per side', stop: STOP_RULES, inFlight: "Same as on Earth; hold a handrail so the body doesn't rotate." },
  pendulum: { id: 'pendulum', name: 'Pendulum swing', target: 'Shoulder joint', steps: ['Lean forward, let the arm hang (on the ground) or float relaxed (in flight).', 'Draw small circles with the hand.', 'Change direction.'], dose: '2 × 30 s each way', stop: STOP_RULES, inFlight: 'No gravity to swing the arm: do slow, relaxed arm circles instead, letting the shoulder stay loose.' },
  scap_squeeze: { id: 'scap_squeeze', name: 'Shoulder-blade squeeze', target: 'Rhomboids, mid trapezius', steps: ['Arms by your side.', 'Squeeze the shoulder blades together and down.', 'Hold, then relax.'], dose: '12 × 5 s', stop: STOP_RULES, inFlight: 'Same as on Earth; add an elastic band for resistance.' },
  glute_bridge: { id: 'glute_bridge', name: 'Glute bridge', target: 'Gluteus maximus', steps: ['Lie on your back, knees bent.', 'Push through the heels and lift the hips.', 'Lower slowly.'], dose: '2 × 12', stop: STOP_RULES, inFlight: 'Feet in foot loops, back against a panel, push against an elastic band or the resistive device.' },
  squat: { id: 'squat', name: 'Partial squat', target: 'Quadriceps, glutes', steps: ['Feet hip-width (in restraints or on the ground).', 'Bend knees to a pain-free depth, knees over toes.', 'Stand back up.'], dose: '2 × 10', stop: STOP_RULES, inFlight: 'Only on the resistive exercise device (ARED) or with a bungee harness — free-floating squats have no load.' },
  calf_raise: { id: 'calf_raise', name: 'Calf raise', target: 'Soleus, gastrocnemius', steps: ['Hold a handrail.', 'Rise up onto the toes.', 'Lower slowly over 3 s.'], dose: '2 × 15', stop: STOP_RULES, inFlight: 'On the resistive device or treadmill harness; without load it does nothing.' },
  balance_hold: { id: 'balance_hold', name: 'Balance hold', target: 'Ankle stabilisers, balance', steps: ['Stand beside a handrail.', 'Lift one foot slightly.', 'Hold steady; switch.'], dose: '3 × 20 s per side', stop: STOP_RULES, inFlight: 'Not possible while floating (there is no up or down). Do it after landing.', needsGravity: true },
  wrist_stretch: { id: 'wrist_stretch', name: 'Wrist extensor stretch', target: 'Forearm extensors', steps: ['Straighten the elbow, palm down.', 'Gently bend the wrist down with the other hand.', 'Hold a light stretch.'], dose: '3 × 20 s', stop: STOP_RULES, inFlight: 'Same as on Earth.' },
  tendon_glide: { id: 'tendon_glide', name: 'Tendon glides', target: 'Finger flexor tendons', steps: ['Open hand straight.', 'Hook fist, then full fist, then straight fist.', 'Move slowly through each.'], dose: '10 slow cycles', stop: STOP_RULES, inFlight: 'Same as on Earth.' },
  quad_set: { id: 'quad_set', name: 'Quadriceps set', target: 'Quadriceps', steps: ['Leg straight.', 'Tighten the thigh to press the back of the knee down.', 'Hold, then relax.'], dose: '10 × 5 s', stop: STOP_RULES, inFlight: 'Works anywhere — press the back of the knee against a panel.' },
  hamstring_stretch: { id: 'hamstring_stretch', name: 'Hamstring stretch', target: 'Hamstrings', steps: ['Leg straight in front.', 'Hinge forward from the hips, back long.', 'Stop at a gentle pull.'], dose: '3 × 30 s', stop: STOP_RULES, inFlight: 'Hook the heel in a foot loop and pull the trunk toward the leg with a handrail.' },
  ankle_pump: { id: 'ankle_pump', name: 'Ankle pumps', target: 'Calf, circulation', steps: ['Point the foot away.', 'Pull the toes up toward you.', 'Keep a steady rhythm.'], dose: '2 × 20', stop: STOP_RULES, inFlight: 'Same as on Earth — useful during long sleep-station periods.' },
  calf_stretch: { id: 'calf_stretch', name: 'Calf stretch', target: 'Soleus, gastrocnemius', steps: ['Knee straight.', 'Pull the toes toward you (towel or band).', 'Hold a gentle stretch; repeat with knee bent.'], dose: '3 × 30 s', stop: STOP_RULES, inFlight: 'Use an elastic band around the forefoot.' },
}
