import type { Cue, Sound } from './sounds'
import cardPlace1 from './sounds/card-place-1.mp3'
import cardPlace2 from './sounds/card-place-2.mp3'
import cardPlace3 from './sounds/card-place-3.mp3'
import cardPlace4 from './sounds/card-place-4.mp3'
import cardShuffle from './sounds/card-shuffle.mp3'
import cardsTakeOut1 from './sounds/cards-take-out-1.mp3'
import cardsTakeOut2 from './sounds/cards-take-out-2.mp3'
import cashRegister from './sounds/cash-register.mp3'
import gameOverJingle from './sounds/game-over.mp3'
import pencilDrop1 from './sounds/pencil-drop-1.mp3'
import pencilDrop2 from './sounds/pencil-drop-2.mp3'
import pencilDrop3 from './sounds/pencil-drop-3.mp3'
import pencilDrop4 from './sounds/pencil-drop-4.mp3'
import pencilTally from './sounds/pencil-tally.mp3'
import turnBell from './sounds/turn-bell.mp3'

const CLIPS = {
  place1: cardPlace1,
  place2: cardPlace2,
  place3: cardPlace3,
  place4: cardPlace4,
  takeOut1: cardsTakeOut1,
  takeOut2: cardsTakeOut2,
  shuffle: cardShuffle,
  bell: turnBell,
  pencil: pencilTally,
  drop1: pencilDrop1,
  drop2: pencilDrop2,
  drop3: pencilDrop3,
  drop4: pencilDrop4,
  register: cashRegister,
  jingle: gameOverJingle,
}
type Clip = keyof typeof CLIPS
const PLACES: Clip[] = ['place1', 'place2', 'place3', 'place4']
const TAKE_OUTS: Clip[] = ['takeOut1', 'takeOut2']
const DROPS: Clip[] = ['drop1', 'drop2', 'drop3', 'drop4']
const pick = (clips: Clip[]) => clips[Math.floor(Math.random() * clips.length)]

/** Everything the player needs once the browser lets it make sound. */
interface Audio {
  ctx: AudioContext
  /** Your own sounds, at full volume. */
  mine: AudioNode
  /** Everyone else's: quieter, and muffled as if from across the table. */
  others: AudioNode
  buffers: Partial<Record<Clip, AudioBuffer>>
  /** Settles once every clip has loaded, or failed to. */
  loaded: Promise<unknown>
}

let audio: Audio | null = null
/** When the last cue scheduled ends, so the next update's cues wait their turn. */
let nextFree = 0

/**
 * Browsers block sound until the player taps or types, so the audio starts on the first
 * gesture anywhere on the page. Before that nothing plays, and nothing is queued. Later
 * gestures resume it again if the browser suspended it (a phone going to the background).
 * Safe to call more than once.
 */
export function listenForUnlock(): void {
  if (unlockListening || typeof window === 'undefined' || !window.AudioContext) return
  unlockListening = true
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, unlock, { capture: true, passive: true })
  }
}
let unlockListening = false

function unlock() {
  if (!audio) audio = start()
  if (audio && audio.ctx.state !== 'running') void audio.ctx.resume().catch(() => {})
}

function start(): Audio | null {
  try {
    // A phone's silent switch mutes the page, and music from another app keeps playing.
    const session = (navigator as { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'ambient'
    const ctx = new AudioContext()
    const others = ctx.createGain()
    others.gain.value = 0.5
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 2200
    others.connect(muffle).connect(ctx.destination)
    const buffers: Audio['buffers'] = {}
    const loaded = Promise.all(
      (Object.entries(CLIPS) as [Clip, string][]).map(([clip, url]) =>
        fetch(url)
          .then((response) => response.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            buffers[clip] = buffer
          })
          .catch(() => {}),
      ),
    )
    return { ctx, mine: ctx.destination, others, buffers, loaded }
  } catch {
    return null
  }
}

/** Plays cues one after another, after any still playing from the last update. */
export function playCues(cues: readonly Cue[]): void {
  const a = audio
  // A suspended context would save the sounds up and play them all at once on resume.
  if (!a || a.ctx.state !== 'running' || cues.length === 0) return
  let at = Math.max(a.ctx.currentTime + 0.02, nextFree)
  // Don't let a backlog build up: cues that would start this late are dropped.
  if (at - a.ctx.currentTime > 3) return
  for (const cue of cues) {
    at += SOUNDS[cue.sound](new Voice(a, cue.mine ? a.mine : a.others, at), cue)
  }
  nextFree = at
}

/**
 * Plays one cue now, for the panel's test button. The press that calls this may be the one
 * that starts the audio, so it waits for the browser to let it play.
 */
export function playTest(cue: Cue): void {
  unlock()
  if (!audio) return
  void Promise.all([audio.ctx.resume(), audio.loaded])
    .then(() => {
      nextFree = 0
      playCues([cue])
    })
    .catch(() => {})
}

/** Plays one sound from `at`, on one output. Offsets are in seconds from `at`. */
class Voice {
  constructor(
    private readonly audio: Audio,
    private readonly out: AudioNode,
    private readonly at: number,
  ) {}

  private get ctx() {
    return this.audio.ctx
  }

  /**
   * A recorded clip, with a little pitch wobble so repeats don't sound mechanical. False if
   * the clip didn't load.
   */
  clip(clip: Clip, offset = 0, gain = 1, rate = 1): boolean {
    const buffer = this.audio.buffers[clip]
    if (!buffer) return false
    const src = this.ctx.createBufferSource()
    const g = this.ctx.createGain()
    src.buffer = buffer
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08)
    g.gain.value = gain
    src.connect(g).connect(this.out)
    src.start(this.at + offset)
    return true
  }

  place(offset = 0, gain = 1, rate = 1) {
    this.clip(pick(PLACES), offset, gain, rate)
  }

  /** A struck tone with inharmonic partials, like a bell. */
  bell(
    freq: number,
    offset: number,
    gain = 0.25,
    decay = 1.4,
    partials = [
      [1, 1],
      [2.76, 0.45],
      [5.4, 0.25],
      [8.93, 0.12],
    ],
  ) {
    const t = this.at + offset
    for (const [mult, amp] of partials) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.frequency.value = freq * mult
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain * amp, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult ** 0.35)
      o.connect(g).connect(this.out)
      o.start(t)
      o.stop(t + decay + 0.1)
    }
  }

  /** Vibraphone: a soft sine with a little fourth harmonic and the motor tremolo. */
  vibe(freq: number, offset: number, gain = 0.22, decay = 1.6) {
    const t = this.at + offset
    const trem = this.ctx.createGain()
    trem.gain.value = 1
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 5.5
    lfoGain.gain.value = 0.25
    lfo.connect(lfoGain).connect(trem.gain)
    for (const [mult, amp] of [
      [1, 1],
      [4, 0.12],
      [10, 0.03],
    ]) {
      const o = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      o.frequency.value = freq * mult
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain * amp, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult ** 0.5)
      o.connect(g).connect(trem)
      o.start(t)
      o.stop(t + decay + 0.1)
    }
    trem.connect(this.out)
    lfo.start(t)
    lfo.stop(t + decay + 0.1)
  }

  /** Filtered white noise with a falling envelope. */
  noise(offset: number, length: number, gain: number, type: BiquadFilterType, freq: number, q = 1) {
    const rate = this.ctx.sampleRate
    const buffer = this.ctx.createBuffer(1, Math.ceil(rate * length), rate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 1.5
    }
    const src = this.ctx.createBufferSource()
    const f = this.ctx.createBiquadFilter()
    const g = this.ctx.createGain()
    src.buffer = buffer
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    g.gain.value = gain
    src.connect(f).connect(g).connect(this.out)
    src.start(this.at + offset)
  }
}

const NOTE = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 }

/** Each sound plays on a voice and returns how long until the next cue may start, in seconds. */
const SOUNDS: Record<Sound, (voice: Voice, cue: Cue) => number> = {
  // A diner counter bell, tapped twice, or a made one if the recording didn't load.
  turn: (v) => {
    if (!v.clip('bell', 0, 0.7)) v.bell(1480, 0, 0.3, 1.6)
    return 0.8
  },
  // A pencil tallying the score and put down, then a shuffle for the next deal.
  roundOver: (v) => {
    if (v.clip('pencil')) {
      // The 1.1-second tally, the pencil dropped on the table, a pause, then the shuffle.
      v.clip(pick(DROPS), 1.25, 0.8)
      v.clip('shuffle', 2.1)
      return 4.5
    }
    // The recording didn't load: a made tally, shorter, so the shuffle comes sooner.
    for (const offset of [0, 0.1, 0.2, 0.3]) v.noise(offset, 0.07, 0.35, 'bandpass', 3600, 0.8)
    v.noise(0.45, 0.16, 0.35, 'bandpass', 3000, 0.7)
    v.clip('shuffle', 0.75)
    return 3.15
  },
  // An orchestral jingle, or a vibraphone ta-da if the recording didn't load.
  gameOver: (v) => {
    // Dense and loud next to the card clips, so it plays quieter.
    if (v.clip('jingle', 0, 0.6)) return 3.6
    ;[NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => v.vibe(f, i * 0.11, 0.18, 1.2))
    for (const f of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]) v.vibe(f, 0.6, 0.14, 2.4)
    return 2.5
  },
  // Lighter than a discard, so the two are easy to tell apart.
  draw: (v) => {
    v.place(0, 0.6, 1.15)
    return 0.3
  },
  discard: (v) => {
    v.place()
    return 0.3
  },
  // One tap per card, a little unevenly spaced, as a hand lays them down.
  meld: (v, cue) => {
    let offset = 0
    for (let i = 0; i < Math.max(1, cue.cards ?? 1); i++) {
      v.place(offset, 0.7)
      offset += 0.22 + Math.random() * 0.08
    }
    return offset + 0.1
  },
  // The pile slid off the table, then two taps squaring it.
  pickup: (v) => {
    v.clip(pick(TAKE_OUTS))
    v.place(0.55, 0.45, 1.2)
    v.place(0.68, 0.45, 1.2)
    return 0.9
  },
  // An old cash register: the drawer opens and the bell rings.
  canasta: (v) => {
    if (v.clip('register')) return 1
    // The recording didn't load: a made one, with a key clunk, "cha-ching" and drawer thump.
    v.noise(0, 0.05, 0.6, 'lowpass', 900)
    v.noise(0.05, 0.09, 0.4, 'lowpass', 500)
    v.bell(2093, 0.12, 0.2, 1.1)
    v.bell(2637, 0.12, 0.14, 1.1)
    v.noise(0.35, 0.18, 0.4, 'lowpass', 400)
    return 0.7
  },
}
