"""Synthesises the 15 s BULKSKART soundtrack (no external samples).

Elements: 120 BPM kick + sub-bass pulse, hi-hats, chord pad, whoosh
transitions, impacts on major words, and a bell sting for the logo reveal.
Output: 44.1 kHz stereo WAV, peak-normalised to about -1 dBFS.

Usage: python3 make_audio.py <out.wav>
"""
import sys
import wave
import numpy as np

SR = 44100
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR
mix = np.zeros(N)


def add(start, sig):
    i = int(start * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    mix[i:i + n] += sig[:n]


def kick(amp=0.9):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    phase = TAU * np.cumsum(f) / SR
    return amp * np.sin(phase) * np.exp(-t * 9)


def hat(amp=0.07):
    n = int(0.05 * SR)
    x = rng.standard_normal(n)
    x = np.diff(x, prepend=0)  # crude high-pass
    return amp * x * np.exp(-np.arange(n) / SR * 90)


def impact(amp=0.8):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = 35 + 70 * np.exp(-t * 7)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    click = rng.standard_normal(n) * np.exp(-t * 160) * 0.6
    ping = np.sin(TAU * 880 * t) * np.exp(-t * 14) * 0.12
    return amp * (body + click + ping)


def whoosh(amp=0.35, dur=0.75):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    low = band = 0.0
    out = np.empty(n)
    q = 1 / 0.7
    for i in range(n):
        p = i / n
        fc = 300 * (6000 / 300) ** p          # 300 Hz -> 6 kHz sweep
        f = 2 * np.sin(np.pi * fc / SR)
        high = x[i] - low - q * band
        band += f * high
        low += f * band
        out[i] = band
    env = np.sin(np.pi * np.arange(n) / n) ** 1.6
    return amp * out * env


def note(freq, dur, amp, attack=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * freq * t) + 0.45 * np.sin(TAU * 2 * freq * t + 0.3) + 0.2 * np.sin(TAU * 3 * freq * t)
    env = np.minimum(1, t / attack) * np.exp(-np.maximum(0, t - dur * 0.6) * 1.8)
    return amp * s * env


def bell(freq, amp=0.14):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * freq * t) + 0.5 * np.sin(TAU * 2.76 * freq * t) * np.exp(-t * 3)
    return amp * s * np.exp(-t * 3.2)


TAU = 2 * np.pi
BEAT = 0.5  # 120 BPM

# --- drums -----------------------------------------------------------------
k = kick()
for b in np.arange(0, DUR, BEAT):
    add(b, k)
for s in np.arange(0.25, DUR, BEAT):
    add(s, hat(0.05))
for s in np.arange(0.125, DUR, BEAT):
    add(s, hat(0.03))

# --- sub bass pulse following chord roots (2 s bars) -----------------------
roots = [55.0, 43.65, 65.41, 49.0]  # A1 F1 C2 G1
chords = [
    [220.0, 261.63, 329.63],  # Am
    [174.61, 220.0, 261.63],  # F
    [261.63, 329.63, 392.0],  # C
    [196.0, 246.94, 293.66],  # G
]
bar_len = 2.0
bass_t = np.arange(N) / SR
bar_idx = (bass_t // bar_len).astype(int) % 4
root_arr = np.array(roots)[bar_idx]
pulse = 0.6 + 0.4 * np.exp(-(bass_t % BEAT) * 8)
mix += 0.22 * np.sin(TAU * np.cumsum(root_arr) / SR) * pulse * (bass_t < 12.0)
# final A-major sub under the logo
mix += 0.16 * np.sin(TAU * 55.0 * bass_t) * ((bass_t >= 12.0) * np.minimum(1, (bass_t - 12.0) / 0.4))

# --- chord pad ---------------------------------------------------------------
for bar in range(8):
    start = bar * bar_len
    if start >= 12.0:
        break
    for f in chords[bar % 4]:
        add(start, note(f, bar_len, 0.05))
# A major for the logo section
for f in (220.0, 277.18, 329.63):
    add(12.0, note(f, 3.0, 0.07, attack=0.5))

# --- transitions and impacts -------------------------------------------------
for w in [2.0, 3.72, 4.0, 6.0, 8.7, 9.0, 10.9, 11.2, 12.0]:
    add(w - 0.05, whoosh())

for hit in [0.1, 0.3, 2.0, 2.18, 4.0, 4.12, 4.24, 4.45, 6.0, 6.15, 6.4,
            9.0, 9.35, 10.9, 11.2, 12.0, 12.55, 12.8, 13.6]:
    add(hit, impact(0.7))

# --- logo bell sting ---------------------------------------------------------
for bt, f in [(12.6, 1760.0), (13.0, 2217.46), (13.4, 2637.02), (13.8, 3520.0)]:
    add(bt, bell(f))

# --- master ------------------------------------------------------------------
mix = np.tanh(mix * 1.1) * 0.92           # gentle saturation / limiting
fade_in = np.minimum(1, t_all / 0.05)
fade_out = np.clip((DUR - t_all) / 0.4, 0, 1)
mix *= fade_in * fade_out
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89                    # ~ -1 dBFS

# slight stereo width via a tiny decorrelated delay on the right channel
delay = int(0.012 * SR)
left = mix
right = np.concatenate([np.zeros(delay), mix[:-delay]])
stereo = np.stack([left, right], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')

out = sys.argv[1]
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, 'samples', N, 'peak before norm', round(float(peak), 3))
