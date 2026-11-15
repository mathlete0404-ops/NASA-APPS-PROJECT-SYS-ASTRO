// Emergency guides: example procedures written for the crewmate who is helping, one action per
// step, adapted to weightlessness. They support, never replace, the vehicle's onboard medical
// checklist, the crew medical officer (CMO) and the flight surgeon. Deterministic content: no AI.

export type GuideId = 'cpr' | 'air' | 'chest' | 'stroke' | 'bleed' | 'dcs' | 'head' | 'storm'
export type Severity = 'Life-threatening' | 'Serious'

export type Step =
  | { kind: 'do'; title: string; body?: string }
  /** A timer the helper can start: countdown seconds, or a CPR beat. */
  | { kind: 'timer'; title: string; body?: string; seconds: number; cpr?: boolean }
  /** Yes/no question whose answer is logged; `alert` text is shown if the answer is yes. */
  | { kind: 'ask'; title: string; body?: string; alert?: string }
  /** Measure heart rate with the camera (or type it). */
  | { kind: 'measure'; title: string; body?: string }
  /** Tick off every crew member. */
  | { kind: 'crew'; title: string; body?: string }
  /** Mark a time in the log (e.g. when symptoms started). */
  | { kind: 'mark'; title: string; body?: string; label: string }

export interface Guide {
  id: GuideId
  title: string
  when: string
  severity: Severity
  steps: Step[]
  /** Switch to another guide if things get worse. */
  escalate?: { to: GuideId; label: string }
  sources: { label: string; url: string }[]
}

const NTRS = (q: string) => `https://ntrs.nasa.gov/search?q=${encodeURIComponent(q)}`
const TELL_CMO: Step = { kind: 'do', title: 'Tell the crew medical officer now.', body: 'Say who, what happened and when. If you are the medical officer, ask a crewmate to help you.' }
const SEND: Step = { kind: 'do', title: 'Send the log to Earth.', body: 'Press “Send log to Earth” below. It arrives after the signal delay, so keep following the onboard checklist while you wait.' }

export const GUIDES: Guide[] = [
  {
    id: 'cpr', severity: 'Life-threatening',
    title: 'Not responding or not breathing (CPR)',
    when: 'Someone does not respond, or is not breathing normally.',
    steps: [
      { kind: 'do', title: 'Call out “Medical emergency!”', body: 'Ask one crewmate to bring the medical kit and the defibrillator (AED), and one to tell the crew medical officer.' },
      { kind: 'ask', title: 'Tap their shoulders and shout their name. Do they respond?', body: 'Then look at the chest for up to 10 seconds. Gasping is not normal breathing.', alert: 'If they respond and breathe normally, stop CPR, keep them still and use “Chest pain” or “Hit to the head” instead.' },
      { kind: 'do', title: 'Restrain them, then restrain yourself.', body: 'Strap them to the medical restraint or a flat panel. Hook your feet into foot loops: in weightlessness you need something to push against.' },
      { kind: 'timer', cpr: true, seconds: 120, title: 'Start chest compressions.', body: 'Centre of the chest, at least 5 cm deep, 100 to 120 per minute, following the beat. In weightlessness use the hand-stand position (feet braced on the opposite wall) or kneel astride and lock arms. Swap rescuers every 2 minutes.' },
      { kind: 'do', title: 'Attach the defibrillator as soon as it arrives.', body: 'Follow its voice prompts. Make sure nobody touches them when it shocks, then restart compressions straight away.' },
      { kind: 'ask', title: 'Are they breathing normally now?', alert: 'Stop compressions, keep them restrained on their side if possible, and watch their breathing until the medical officer takes over.' },
      SEND,
    ],
    sources: [
      { label: 'NASA NTRS: CPR in microgravity', url: NTRS('cardiopulmonary resuscitation microgravity') },
      { label: 'American Heart Association CPR guidelines', url: 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines' },
    ],
  },
  {
    id: 'air', severity: 'Life-threatening',
    title: 'Smoke, ammonia or toxic air',
    when: 'Smoke, a chemical smell, or a fire or toxic-air alarm.',
    steps: [
      { kind: 'do', title: 'Put on your mask or breathing apparatus first.', body: 'You cannot help anyone if you breathe it in.' },
      { kind: 'do', title: 'Follow the vehicle’s fire or toxic-atmosphere procedure.', body: 'Usually: move to the safe module the procedure names and close the hatch behind the crew.' },
      { kind: 'crew', title: 'Account for every crew member.', body: 'Tick each person when you have seen them, masked, in the safe area.' },
      { kind: 'ask', title: 'Is anyone coughing, short of breath, or with sore eyes or skin?', alert: 'Rinse eyes or skin with clean water for 15 minutes, keep them masked and resting, and tell the medical officer.' },
      { kind: 'measure', title: 'Check the heart rate of anyone exposed.' },
      TELL_CMO, SEND,
    ],
    sources: [{ label: 'NASA NTRS: ISS ammonia leak response', url: NTRS('ISS ammonia leak crew response') }],
  },
  {
    id: 'chest', severity: 'Life-threatening',
    title: 'Chest pain or a racing, uneven heartbeat',
    when: 'Chest pain or pressure, or a heartbeat that is very fast, slow or uneven.',
    steps: [
      { kind: 'do', title: 'Stop all activity. Strap in and rest.', body: 'No exercise. A crewmate stays with them.' },
      TELL_CMO,
      { kind: 'measure', title: 'Measure heart rate now.', body: 'Use the camera, or the medical kit if you have one. Also record blood pressure and oxygen if the kit has them.' },
      { kind: 'do', title: 'Open the onboard cardiac checklist and follow it.', body: 'Give medicines such as aspirin only as the checklist and the medical officer direct.' },
      { kind: 'timer', seconds: 300, title: 'Rest for 5 minutes, then measure again.' },
      { kind: 'measure', title: 'Measure heart rate again.' },
      SEND,
    ],
    escalate: { to: 'cpr', label: 'They stopped responding or breathing' },
    sources: [{ label: 'NASA HRP: risk of cardiovascular adaptations', url: 'https://humanresearchroadmap.nasa.gov/risks/' }],
  },
  {
    id: 'stroke', severity: 'Life-threatening',
    title: 'Face drooping, weak arm or slurred speech',
    when: 'Sudden one-sided weakness or numbness, face drooping, slurred speech, or a sudden severe headache or vision change.',
    steps: [
      { kind: 'mark', label: 'Symptoms started', title: 'Mark when the symptoms started.', body: 'The time matters most for treatment. If you are not sure, mark when they were last seen well.' },
      { kind: 'ask', title: 'Face: ask them to smile. Does one side droop?' },
      { kind: 'ask', title: 'Arms: ask them to raise both arms. Does one drift down?' },
      { kind: 'ask', title: 'Speech: ask them to repeat a short sentence. Is it slurred or strange?' },
      TELL_CMO,
      { kind: 'do', title: 'Keep them still and restrained. Nothing to eat or drink.' },
      { kind: 'measure', title: 'Measure heart rate.' },
      SEND,
    ],
    escalate: { to: 'cpr', label: 'They stopped responding or breathing' },
    sources: [{ label: 'NASA HRP: human health risks', url: 'https://humanresearchroadmap.nasa.gov/risks/' }],
  },
  {
    id: 'bleed', severity: 'Serious',
    title: 'Heavy bleeding',
    when: 'Bleeding that is heavy or will not stop.',
    steps: [
      { kind: 'do', title: 'Put on gloves.', body: 'Bring gauze and absorbent pads from the medical kit.' },
      { kind: 'do', title: 'Press firmly on the wound with gauze.', body: 'In weightlessness blood floats as drops: catch it with absorbent pads and keep it away from eyes and equipment.' },
      { kind: 'timer', seconds: 600, title: 'Keep pressing for 10 minutes without lifting.', body: 'If blood soaks through, add more gauze on top. Do not remove the first layer.' },
      { kind: 'ask', title: 'Is a limb still bleeding heavily after 10 minutes?', alert: 'Apply the tourniquet from the medical kit as trained, high on the limb, and mark the time it went on.' },
      TELL_CMO, SEND,
    ],
    sources: [{ label: 'NASA HRP: human health risks', url: 'https://humanresearchroadmap.nasa.gov/risks/' }],
  },
  {
    id: 'dcs', severity: 'Life-threatening',
    title: 'Pain or tingling after a spacewalk',
    when: 'Joint pain, tingling, itching, numbness or confusion during or after an EVA (possible decompression sickness).',
    steps: [
      { kind: 'mark', label: 'Symptoms started', title: 'Mark when the symptoms started.' },
      TELL_CMO,
      { kind: 'do', title: 'Treat it as decompression sickness until ruled out.', body: 'Follow the onboard DCS procedure: usually 100% oxygen, and the suit may be repressurised as treatment.' },
      { kind: 'ask', title: 'Any confusion, weakness, trouble breathing or vision change?', alert: 'These are serious signs: tell the medical officer and the ground at once.' },
      { kind: 'measure', title: 'Measure heart rate.' },
      SEND,
    ],
    sources: [{ label: 'NASA HRP: decompression sickness', url: 'https://humanresearchroadmap.nasa.gov/risks/' }],
  },
  {
    id: 'head', severity: 'Serious',
    title: 'Hit to the head, fall or impact',
    when: 'A blow to the head or body, or a hard landing or fall.',
    steps: [
      { kind: 'ask', title: 'Neck pain, numbness or weakness in the arms or legs?', alert: 'Keep the head and neck still and restrained. Do not move them until the medical officer says so.' },
      { kind: 'ask', title: 'Did they pass out, vomit, or are they confused or very sleepy?', alert: 'Serious head injury signs: tell the medical officer now.' },
      TELL_CMO,
      { kind: 'measure', title: 'Measure heart rate.' },
      { kind: 'do', title: 'Rest, no exercise, and check on them every hour today.', body: 'Use “Something hurts” to record where it hurts.' },
      SEND,
    ],
    sources: [{ label: 'NASA HRP: human health risks', url: 'https://humanresearchroadmap.nasa.gov/risks/' }],
  },
  {
    id: 'storm', severity: 'Serious',
    title: 'Solar radiation storm',
    when: 'A radiation storm warning, or the Space weather status turns red.',
    steps: [
      { kind: 'do', title: 'Go to the best-shielded area.', body: 'Follow the mission’s storm-shelter rules.' },
      { kind: 'do', title: 'Stop or postpone any spacewalk.', body: 'Crew outside return to shelter.' },
      { kind: 'crew', title: 'Account for every crew member in the shelter.' },
      { kind: 'mark', label: 'Entered shelter', title: 'Mark the time you entered the shelter.' },
      { kind: 'do', title: 'Stay until the storm level falls.', body: 'Check the Space weather card on Today. The vehicle’s dosimeters and mission rules decide when it is safe.' },
      SEND,
    ],
    sources: [{ label: 'NOAA Space Weather Scales', url: 'https://www.swpc.noaa.gov/noaa-scales-explanation' }],
  },
]

export const GUIDE = Object.fromEntries(GUIDES.map((g) => [g.id, g])) as Record<GuideId, Guide>

/** “Not sure what is happening?” — yes/no questions, most dangerous first. */
export const TRIAGE_QUESTIONS: { q: string; guide: GuideId }[] = [
  { q: 'Is someone not responding, or not breathing normally?', guide: 'cpr' },
  { q: 'Is there smoke, a chemical smell, or a toxic-air alarm?', guide: 'air' },
  { q: 'Chest pain, or a heartbeat that is racing, very slow or uneven?', guide: 'chest' },
  { q: 'Face drooping, a weak arm, slurred speech, or a sudden severe headache?', guide: 'stroke' },
  { q: 'Bleeding that is heavy or will not stop?', guide: 'bleed' },
  { q: 'Pain, tingling or itching during or after a spacewalk?', guide: 'dcs' },
  { q: 'A hit to the head, a fall or an impact?', guide: 'head' },
  { q: 'A radiation storm warning?', guide: 'storm' },
]
