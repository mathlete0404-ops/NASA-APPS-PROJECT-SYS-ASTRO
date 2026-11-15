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
OPEN, BAR, END = 3.5, 1.9, 3.5 + 13 * 1.9
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

# ---------------------------------------------------------------- opening (0 - 3.5 s): space
drone = (tone(note(33), OPEN + 0.6) * 0.5 + tone(note(45), OPEN + 0.6) * 0.25 + tone(note(52), OPEN + 0.6) * 0.12)
drone *= np.minimum(1, np.arange(len(drone)) / (SR * 1.2)) * np.linspace(1, 0.6, len(drone))
add(drone, 0, 0.32)
air = band_noise(OPEN + 0.4, 300, 2400, seed=1) * np.linspace(0.05, 0.6, int((OPEN + 0.4) * SR)) ** 2
add(air, 0, 0.18, -0.3); add(band_noise(OPEN + 0.4, 300, 2400, seed=2) * np.linspace(0.05, 0.6, int((OPEN + 0.4) * SR)) ** 2, 0, 0.18, 0.3)
# shimmer: slow high bell notes over the planets
for k, m in enumerate([76, 83, 81, 88]):
    add(tone(note(m), 2.2) * env(2.2, 0.02, 0.9), 0.4 + k * 0.75, 0.05, -0.5 + k * 0.33)

# ---------------------------------------------------------------- groove (3.5 s - end card)
# A minor - F - C - G, one chord per bar (= one feature)
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
BASS = [45, 41, 36, 43]
nbars = 13
for b in range(nbars):
    t0 = OPEN + b * BAR
    ch, bs = CHORDS[b % 4], BASS[b % 4]
    lift = 0.6 if b == 0 else 1.0
    # pad: soft saw chord, slow attack, stereo spread
    for j, m in enumerate(ch):
        pad = tone(note(m + 12), BAR + 0.15, 'saw', 0.002 * (j - 1)) * env(BAR + 0.15, 0.12, 2.0, 0.6, 0.12)
        add(pad, t0, 0.05 * lift, (-0.5, 0, 0.5)[j])
    # bass on beats 1 and 3, plus a pickup
    for bt, ln in ((0, 0.42), (2, 0.42), (3.5, 0.2)):
        bas = (tone(note(bs), ln) + 0.3 * tone(note(bs + 12), ln)) * env(ln, 0.004, 0.18, 0.35, 0.03)
        add(bas, t0 + bt * BEAT, 0.22 * lift)
    # kick on every beat (four on the floor), quieter on 2 and 4
    for bt in range(4):
        kl = 0.28
        tt = np.arange(int(kl * SR)) / SR
        f = 48 + 90 * np.exp(-tt / 0.035)
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.12)
        add(kick, t0 + bt * BEAT, (0.55 if bt % 2 == 0 else 0.4) * lift)
    # hats on the off-beats, a clap on 2 and 4
    for bt in range(4):
        hat = band_noise(0.06, 7000, 15000) * env(0.06, 0.001, 0.018)
        add(hat, t0 + (bt + 0.5) * BEAT, 0.07 * lift, 0.35)
        if bt in (1, 3):
            clap = band_noise(0.16, 900, 5000) * env(0.16, 0.002, 0.05)
            add(clap, t0 + bt * BEAT, 0.12 * lift, -0.1)
    # arpeggio (16ths) over the chord, gentle
    arp = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24]
    for s16 in range(16):
        if b == 0 and s16 < 8: continue
        m = arp[s16 % 4]
        bl = tone(note(m), 0.16) * env(0.16, 0.002, 0.06)
        add(bl, t0 + s16 * BEAT / 4, 0.035, 0.45 if s16 % 2 else -0.45)

# ---------------------------------------------------------------- end card: resolve and ring out
ring = 30 - END
for j, m in enumerate([57, 60, 64, 69]):
    add(tone(note(m + 12), ring, 'saw') * env(ring, 0.05, 1.4, 0.0), END, 0.06, (-0.6, -0.2, 0.2, 0.6)[j])
add((tone(note(33), ring) * 0.6) * env(ring, 0.01, 1.2), END, 0.3)

# ---------------------------------------------------------------- sound effects from the timeline
def whip():
    ln = 0.32
    x = band_noise(ln, 500, 7000)
    tt = np.arange(len(x)) / SR
    shape = np.exp(-((tt - 0.14) / 0.07) ** 2)
    return x * shape

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
for e in SFX:
    k, t0 = e['k'], e['t']
    if k == 'whip': add(whip(), t0 - 0.14, 0.5, rng.uniform(-0.4, 0.4))
    elif k == 'flip': add(whip(), t0 - 0.14, 0.38, 0.0)
    elif k == 'tap': add(tap(), t0, 0.5, 0.15)
    elif k == 'ping': add(ping(), t0, 0.22, -0.1)
    elif k == 'hatch': add(hatch(), t0, 0.3, 0.2)
    elif k == 'rise': add(rise(), t0 - 0.65, 0.3, 0)
    elif k == 'logo': add(logo(), t0, 0.22, 0)

# ---------------------------------------------------------------- master: fades, soft limit, normalise
fade_in = np.minimum(1, t_all / 0.4)
fade_out = np.clip((DUR - t_all) / 1.2, 0, 1)
mix = np.stack([L, R], 1) * (fade_in * fade_out)[:, None]
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix *= 0.89 / (np.abs(mix).max() + 1e-9)   # about -1 dBFS peak
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[2], f'{DUR:.0f} s', 'peak', float(np.abs(mix).max()))
