"""Original soundtrack for the ad, synthesised from scratch (no samples, no third-party audio).

Bars line up with the timeline: each 1.9 s feature = one bar of 4 beats (126.3 bpm), starting
at 3.5 s. Sound effects come from window.__SFX in ad/index.html (whips, cursor taps, the
notification ping, the pet hatch, the end-card flip and logo).

Usage: python make_sound.py sfx.json out.wav
"""
import json, sys, wave
import numpy as np

SR = 48000
DUR = 30.0
_T = next((e for e in json.load(open(sys.argv[1])) if e['k'] == 'timing'), None)
OPEN, BAR, END = (_T['open'], _T['bar'], _T['end']) if _T else (3.5, 1.9, 3.5 + 13 * 1.9)
BEAT = BAR / 4
rng = np.random.default_rng(7)
n = int(SR * DUR)
L = np.zeros(n); R = np.zeros(n)
t_all = np.arange(n) / SR


def env(length, a=0.005, d=0.2, sustain=0.0, r=0.0):
    t = np.arange(int(length * SR)) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.where(t < a, 1, sustain + (1 - sustain) * np.exp(-(t - a) / max(d, 1e-4)))
    if r:
        tail = int(r * SR)
        if tail < len(e): e[-tail:] *= np.linspace(1, 0, tail)
    return e


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= n: return
    sig = sig[: n - i]
    gl, gr = gain * np.sqrt((1 - pan) / 2), gain * np.sqrt((1 + pan) / 2)
    L[i:i + len(sig)] += sig * gl
    R[i:i + len(sig)] += sig * gr


def band_noise(length, lo, hi, seed=None):
    m = int(length * SR)
    x = (np.random.default_rng(seed) if seed is not None else rng).standard_normal(m)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(m, 1 / SR)
    X *= ((f >= lo) & (f <= hi)) * 1.0
    y = np.fft.irfft(X, m)
    return y / (np.abs(y).max() + 1e-9)


def tone(freq, length, shape='sine', detune=0.0):
    t = np.arange(int(length * SR)) / SR
    if shape == 'sine':
        return np.sin(2 * np.pi * freq * t)
    # soft saw: a few harmonics (band-limited)
    y = np.zeros_like(t)
    for k in range(1, 7):
        y += np.sin(2 * np.pi * freq * k * t * (1 + detune)) / k * (0.85 ** k)
    return y / 1.6


note = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# ---------------------------------------------------------------- opening: the journey
def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)          # gentle 2nd-order-like roll-off
    return np.fft.irfft(X, len(x))

def reverb(x, secs=2.8, wet=0.35, seed=5):
    """Convolve with a decaying noise tail: a big, dark space."""
    m = int(secs * SR)
    ir = np.random.default_rng(seed).standard_normal(m) * np.exp(-np.arange(m) / (SR * secs / 6.5))
    ir = lowpass(ir, 2500); ir /= np.abs(ir).sum() / 40
    n2 = 1 << int(np.ceil(np.log2(len(x) + m)))
    y = np.fft.irfft(np.fft.rfft(x, n2) * np.fft.rfft(ir, n2), n2)[: len(x)]
    return x * (1 - wet) + y * wet

OL = OPEN + 0.6
to = np.arange(int(OL * SR)) / SR
# 1) radio: Quindar tones (the beeps that opened and closed Apollo-era air-to-ground calls) with band-limited static
for t0, f0 in ((0.12, 2525.0), (1.32, 2475.0)):
    q = tone(f0, 0.25) * env(0.25, 0.004, 1.0, 1.0, 0.02)
    add(q, t0, 0.07, -0.2)
static = band_noise(1.5, 300, 3000, seed=9) * env(1.5, 0.05, 0.6, 0.7, 0.2)
add(static, 0.1, 0.035, 0.1)
# 2) engine and hull: deep rumble (brown noise, low-passed) with a slow surge, plus a sub tone
brown = np.cumsum(np.random.default_rng(3).standard_normal(len(to)))
_w = 4801; _c = np.concatenate([[0], np.cumsum(brown)])
_ma = (_c[_w:] - _c[:-_w]) / _w  # moving average (length N - w + 1)
_ma = np.concatenate([np.full(_w // 2, _ma[0]), _ma, np.full(len(brown) - len(_ma) - _w // 2, _ma[-1])])
brown = brown - _ma  # remove the slow drift
rumble = lowpass(brown, 110); rumble /= np.abs(rumble).max() + 1e-9
swell = np.clip((to - 0.2) / 3.6, 0, 1) ** 1.6 * (1 + 0.18 * np.sin(2 * np.pi * 0.35 * to))
fade = np.clip((OL - to) / 0.9, 0, 1)
add(rumble * swell * fade, 0, 0.85, -0.15); add(np.roll(rumble, 2400) * swell * fade, 0, 0.85, 0.15)
sub = (np.sin(2 * np.pi * 36 * to) + 0.5 * np.sin(2 * np.pi * 54 * to)) * np.clip((to - 1.4) / 2.5, 0, 1) * fade
add(sub, 0, 0.22)
# 3) cabin: life-support fan and electrical hum, once we are "on board" (after the team card)
fan = band_noise(OL, 400, 6000, seed=4) * np.clip((to - 1.6) / 0.8, 0, 1) * fade
add(fan, 0, 0.025, 0.3)
hum = sum(np.sin(2 * np.pi * 60 * k * to) / k for k in (1, 2, 3)) * np.clip((to - 1.6) / 0.8, 0, 1) * fade
add(hum, 0, 0.018)
# 4) the Moon passing close to the lens: a heavy, slow doppler whoosh
GLSH = 1.4
ln = 1.6; x = band_noise(ln, 150, 5000, seed=12); tt = np.arange(len(x)) / SR
add(x * np.exp(-((tt - 0.85) / 0.33) ** 2), GLSH + 1.95 - 0.85, 0.28, -0.5)
# 5) riser into the title: rising noise and a gliding tone
rl = 4.52 - 3.0; tt = np.arange(int(rl * SR)) / SR
rise = band_noise(rl, 1500, 12000, seed=13) * (tt / rl) ** 3
glide = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2.2 * tt / rl)) / SR) * (tt / rl) ** 2
add(rise, 3.0, 0.12); add(glide, 3.0, 0.05)
# 6) the title hit: a sub drop, a dark impact and a long tail
bl = 3.2; tt = np.arange(int(bl * SR)) / SR
drop = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-tt / 0.25)) / SR) * np.exp(-tt / 1.1)
crack = lowpass(np.random.default_rng(14).standard_normal(len(tt)), 900) * np.exp(-tt / 0.18)
crack /= np.abs(crack).max() + 1e-9
boom = reverb(np.concatenate([drop * 0.9 + crack * 0.6, np.zeros(SR)]), 3.0, 0.45)
# 7) under the title: a wide, open chord that leads into the groove
for j, m in enumerate([45, 52, 57, 64, 69]):
    pad = tone(note(m), OPEN - 4.5 + 0.5, 'saw', 0.003 * (j - 2)) * env(OPEN - 4.5 + 0.5, 0.25, 3.0, 0.8, 0.3)
    add(pad, 4.5, 0.03, (-0.6, -0.3, 0, 0.3, 0.6)[j])
# a few high, slow bells over the planets
for k, m in enumerate([76, 83, 81, 88]):
    add(tone(note(m), 2.2) * env(2.2, 0.02, 0.9), 2.0 + k * 0.6, 0.035, -0.5 + k * 0.33)

# ---------------------------------------------------------------- music (v2): after the opening
# Uplifting cinematic electronic in D major, one chord per feature (I-V-vi-IV), half-time drums,
# a breathing (side-chained) pad, a plucked arpeggio with ping-pong echo and a bell motif.
BEAT = BAR / 4
CHORDS = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]]   # D, A, Bm, G
ROOTS = [38, 33, 35, 31]
MOTIF = [(0, 78, 1.0), (1, 76, 1.0), (2, 74, 1.5), (3.5, 69, 0.5)]  # (beat, note, beats), every 2 bars
nb = 13
QUIET = {9}            # the danger-signs feature: drums drop out for a breath
pump_t = np.arange(int(BEAT * SR)) / SR
pump = 1 - 0.55 * np.exp(-pump_t / 0.09)          # side-chain shape per beat

def saw_pad(m, ln, voices=5, spread=0.006):
    t = np.arange(int(ln * SR)) / SR; y = np.zeros_like(t)
    for v in range(voices):
        d = spread * (v - (voices - 1) / 2)
        for k in range(1, 9): y += np.sin(2 * np.pi * note(m) * k * (1 + d) * t + v) / k * 0.82 ** k
    return y / voices / 1.4

def pluck(m, ln=0.32):
    t = np.arange(int(ln * SR)) / SR
    y = sum(np.sin(2 * np.pi * note(m) * k * t) * np.exp(-t * (9 + 6 * k)) / k for k in range(1, 6))
    return y

for b in range(nb):
    t0 = OPEN + b * BAR
    ch, rt = CHORDS[b % 4], ROOTS[b % 4]
    build = min(1.0, 0.55 + 0.15 * b)               # opens up over the first bars
    quiet = b in QUIET
    # pad, breathing with the beat
    pad = sum(saw_pad(m + 12, BAR + 0.2) for m in ch)
    pad = lowpass(pad, 900 + 2600 * build) * env(BAR + 0.2, 0.08, 3.0, 0.9, 0.18)
    pumpline = np.tile(pump, 5)[: len(pad)]
    add(pad * (1 if quiet else pumpline), t0, 0.022, -0.35); add(np.roll(pad, 600) * (1 if quiet else pumpline), t0, 0.022, 0.35)
    # sub bass: root on 1, octave pickups
    for bt, ln, oc in ((0, 1.6 * BEAT, 0), (2, 0.9 * BEAT, 0), (3.5, 0.4 * BEAT, 12)):
        bs = (np.sin(2 * np.pi * note(rt + oc) * np.arange(int(ln * SR)) / SR) + 0.25 * tone(note(rt + 12 + oc), ln)) * env(ln, 0.006, 0.5, 0.6, 0.04)
        add(bs, t0 + bt * BEAT, 0.0 if quiet else 0.24)
    # plucked arpeggio (16ths) with a ping-pong echo
    arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[1] + 24]
    for s16 in range(16):
        if b == 0 and s16 < 4: continue
        p = pluck(arp[s16 % 8]); tt = t0 + s16 * BEAT / 4
        g = 0.05 * build * (0.7 if s16 % 4 else 1.0)
        add(p, tt, g, -0.25); add(p, tt + 0.75 * BEAT, g * 0.45, 0.6); add(p, tt + 1.5 * BEAT, g * 0.2, -0.6)
    # drums: half-time. kick on 1 and the "and" of 2, clap on 3, soft shaker 16ths
    if not quiet:
        for bt in (0, 1.5):
            kl = 0.4; tt = np.arange(int(kl * SR)) / SR
            kick = np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-tt / 0.03)) / SR) * np.exp(-tt / 0.16)
            add(kick, t0 + bt * BEAT, 0.5)
        clap = sum(band_noise(0.22, 900, 6000, seed=40 + b * 3 + j) * env(0.22, 0.001, 0.06) for j in range(3))
        clap = reverb(np.concatenate([clap, np.zeros(int(0.8 * SR))]), 1.2, 0.4, seed=7)
        add(clap, t0 + 2 * BEAT, 0.13, 0.05)
        for s16 in range(16):
            sh = band_noise(0.05, 6000, 14000, seed=200 + s16) * env(0.05, 0.002, 0.012)
            add(sh, t0 + s16 * BEAT / 4 + (0.012 if s16 % 2 else 0), 0.03 * (1.3 if s16 % 4 == 2 else 1) * build, 0.4)
    # bell motif every second bar
    if b % 2 == 1:
        for bt, m, ln in MOTIF:
            bell = (tone(note(m), ln * BEAT + 1.2) + 0.35 * tone(note(m + 12), ln * BEAT + 1.2)) * env(ln * BEAT + 1.2, 0.004, 0.55)
            add(bell, t0 + bt * BEAT, 0.035, 0.2)
# into the end card: a short riser
rl = BAR * 0.9; tt = np.arange(int(rl * SR)) / SR
add(band_noise(rl, 2000, 12000, seed=77) * (tt / rl) ** 3, END - rl, 0.09)

# ---------------------------------------------------------------- end card: resolve on a wide D chord
ring = 30 - END
for j, m in enumerate([50, 57, 62, 66, 69, 74]):
    add(saw_pad(m + 12, ring) * env(ring, 0.03, 1.6, 0.0), END, 0.035, (-0.7, -0.4, -0.1, 0.1, 0.4, 0.7)[j])
add((np.sin(2 * np.pi * note(38) * np.arange(int(ring * SR)) / SR)) * env(ring, 0.01, 1.2), END, 0.25)
add(reverb(np.concatenate([(tone(note(86), 1.2) + 0.4 * tone(note(93), 1.2)) * env(1.2, 0.003, 0.5), np.zeros(SR)]), 2.0, 0.5), END + 0.1, 0.06)

# ---------------------------------------------------------------- sound effects from the timeline
def whip():
    ln = 0.32
    x = band_noise(ln, 500, 7000)
    tt = np.arange(len(x)) / SR
    shape = np.exp(-((tt - 0.14) / 0.07) ** 2)
    return x * shape

def key(rng_k):
    ln = 0.06; t = np.arange(int(ln * SR)) / SR
    click = band_noise(ln, 2200, 7500, seed=int(rng_k.integers(1e6))) * np.exp(-t / 0.0045)
    thock = np.sin(2 * np.pi * rng_k.uniform(170, 260) * t) * np.exp(-t / 0.014)
    return click * 0.8 + thock * 0.55

def tap():
    ln = 0.05
    tt = np.arange(int(ln * SR)) / SR
    return (np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt / 0.008) + band_noise(ln, 2000, 9000) * np.exp(-tt / 0.004) * 0.6)

def ping():
    out = np.zeros(int(0.9 * SR))
    for k, (m, d) in enumerate([(88, 0.0), (95, 0.11)]):
        s = tone(note(m), 0.75) * env(0.75, 0.003, 0.35)
        i = int(d * SR); out[i:i + len(s)] += s
    return out

def hatch():
    out = np.zeros(int(1.4 * SR))
    crack = band_noise(0.09, 1500, 9000) * env(0.09, 0.001, 0.02)
    out[:len(crack)] += crack * 1.2
    for k, m in enumerate([84, 88, 91, 96, 100]):
        s = tone(note(m), 0.6) * env(0.6, 0.002, 0.22)
        i = int((0.05 + k * 0.07) * SR); out[i:i + len(s)] += s * 0.55
    return out

def rise():
    ln = 0.9
    x = band_noise(ln, 800, 9000) * np.linspace(0, 1, int(ln * SR)) ** 3
    return x

def logo():
    out = np.zeros(int(1.3 * SR))
    for m in (81, 88, 93):
        s = tone(note(m), 1.3) * env(1.3, 0.004, 0.5)
        out += s * 0.4
    return out

SFX = json.load(open(sys.argv[1]))
# keystrokes: never more than ~18 per second (a fast typist), slightly humanised
krng = np.random.default_rng(21); last = -1.0
for e in sorted((e for e in SFX if e['k'] == 'key'), key=lambda e: e['t']):
    if e['t'] - last < 0.055: continue
    last = e['t']
    add(key(krng), e['t'] + krng.uniform(-0.004, 0.006), 0.21 * e.get('vol', 1) * krng.uniform(0.75, 1.1), krng.uniform(-0.25, 0.25))
for e in SFX:
    k, t0 = e['k'], e['t']
    if k == 'whip': add(whip(), t0 - 0.14, 0.5, rng.uniform(-0.4, 0.4))
    elif k == 'flip': add(whip(), t0 - 0.14, 0.38, 0.0)
    elif k == 'tap': add(tap(), t0, 0.5, 0.15)
    elif k == 'ping': add(ping(), t0, 0.22, -0.1)
    elif k == 'hatch': add(hatch(), t0, 0.3, 0.2)
    elif k == 'rise': add(rise(), t0 - 0.65, 0.18, 0)
    elif k == 'logo': add(logo(), t0, 0.22, 0)

# ---------------------------------------------------------------- master: fades, soft limit, normalise
fade_in = np.minimum(1, t_all / 0.4)
# a breath of near-silence right before the title hit, so the impact lands
duck = np.ones(n); i0, i1, i2 = int(4.30 * SR), int(4.49 * SR), int(4.52 * SR)
duck[i0:i1] = np.linspace(1, 0.12, i1 - i0); duck[i1:i2] = 0.12
L *= duck; R *= duck
add(boom, 4.52, 0.62)  # the hit itself is not ducked
fade_out = np.clip((DUR - t_all) / 1.2, 0, 1)
mix = np.stack([L, R], 1) * (fade_in * fade_out)[:, None]
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix *= 0.89 / (np.abs(mix).max() + 1e-9)   # about -1 dBFS peak
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[2], f'{DUR:.0f} s', 'peak', float(np.abs(mix).max()))
