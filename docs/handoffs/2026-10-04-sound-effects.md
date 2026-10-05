# Sound effects: handoff

The design and every sound are decided. No code is written yet. Pick up from **Build plan** below.

## Status

- **Design approved.** Mockup with a working demo: https://claude.ai/artifact/6DJfMm1ZiFyGrHEKqNzBuK (private, open it while signed in).
- **Sounds picked** on the sound board: https://claude.ai/artifact/DSQVAyes9jh6dmDUVALJW3 (private). Its page source holds the exact recipes, and an Artifact `read` of that URL returns it.
- **The todo** (`docs/todo.md`, the "Add sound effects" item) has the decisions. That edit is **not committed yet**.
- **Git:** `main` is one commit ahead of `origin` (`3600a83`, Main menu frees the seat). It is not pushed.

## Decisions

- **One speaker button, icon only**, at the end of the table's top tools (`.gameTools` in `Table.tsx`), next to **Rules**. It works the same on desktop and phone. The icon shows the step: crossed out, then one, two or three sound waves. Its label for screen readers names the step ("Sound: My plays").
- **The button opens a panel** with a four-step slider, "What you hear":

  | Step | Plays |
  | --- | --- |
  | 0 Off | Nothing |
  | 1 Turn alert | Your turn, round over, game over |
  | 2 My plays (**default**) | Adds your own draws, melds, discards, pickups and canastas |
  | 3 Whole table | Adds everyone else's moves, quieter and a little muffled |

  The panel also has a one-line hint for the chosen step, a **Play a test sound** button, and a **What each step plays** link. The link opens the chart of all sounds against the four steps, with your step's column shaded. On a phone the chart is a bottom sheet, like the Scores sheet. The mockup shows all of this.
- **The choice is kept in the browser** (`localStorage`, like Spread / One line in `storage.ts`).
- **Not in this version:** a volume slider, music, sounds for chat lines.
- **Everything a sound tells you also shows on screen.**

## The picked sounds

| Moment | Step | Recipe |
| --- | --- | --- |
| Your turn starts | 1 | Made in the browser: diner counter bell, `bell(1480, 0, 0.3, 1.6)` |
| Round over | 1 | Made in the browser: pencil tally, then `card-shuffle` at +0.75 s |
| Game over | 1 | Made in the browser: vibraphone ta-da |
| You draw | 2 | `card-place-1..4` (random take), gain 0.6, playback rate 1.15 ("lighter", so it differs from a discard) |
| You discard | 2 | `card-place-1..4` (random take) |
| You meld | 2 | One `card-place` per card melded, gain 0.7. The gap starts at 230 ms and shrinks ×0.72 each card, never below 60 ms. |
| You take the pile | 2 | `card-fan-2`, then two `card-place` taps at +0.55 s and +0.68 s, gain 0.45, rate 1.2 ("square the deck") |
| You make a canasta | 2 | Made in the browser: cash register |
| Other players' moves | 3 | The same sounds through a quieter, muffled path: gain about 0.5, plus a lowpass around 2.2 kHz |

Every sample plays with a random pitch wobble: playback rate × (0.96 to 1.04).

### Sample files

- **Source:** `~/Downloads/Sound Effects/kenney_casino-audio/Audio/` (Kenney "Casino Audio", CC0, from kenney.nl). Only these are needed: `card-place-1..4.ogg`, `card-fan-2.ogg`, `card-shuffle.ogg`.
- **Convert to MP3** (Safari doesn't reliably play `.ogg`), and trim the silence at the start (45 to 90 ms in the originals):

  ```sh
  ffmpeg -nostdin -y -i card-place-1.ogg \
    -af "silenceremove=start_periods=1:start_threshold=-50dB" \
    -ac 1 -ar 44100 -b:a 64k card-place-1.mp3
  ```

  The results are about 5 to 20 KB each.
- **Suggested home:** `apps/web/src/sounds/`, imported in TypeScript (Vite gives back a hashed URL; `vite/client` types already cover `*.mp3`). Add a short `LICENSE.txt` there, as `src/fonts/OFL.txt` does for the fonts. Kenney's CC0 text is in the pack's `License.txt`.

### Made-in-browser recipes

These are from the sound board, where `master()` is the output node. In the game, route them through the mine/others path as well.

```js
// A struck tone with inharmonic partials, like a bell.
function bell(freq, at, gain = 0.25, decay = 1.4,
    partials = [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]]) {
  const t = c.currentTime + at
  partials.forEach(([mult, amp]) => {
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = freq * mult
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain * amp, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult ** 0.35)
    o.connect(g).connect(master()); o.start(t); o.stop(t + decay + 0.1)
  })
}

// Vibraphone: a soft sine with a little fourth harmonic and the motor tremolo.
function vibe(freq, at, gain = 0.22, decay = 1.6) {
  const t = c.currentTime + at
  const trem = c.createGain(); trem.gain.value = 1
  const lfo = c.createOscillator(), lfoGain = c.createGain()
  lfo.frequency.value = 5.5; lfoGain.gain.value = 0.25
  lfo.connect(lfoGain).connect(trem.gain)
  ;[[1, 1], [4, 0.12], [10, 0.03]].forEach(([mult, amp]) => {
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = freq * mult
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain * amp, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult ** 0.5)
    o.connect(g).connect(trem); o.start(t); o.stop(t + decay + 0.1)
  })
  trem.connect(master()); lfo.start(t); lfo.stop(t + decay + 0.1)
}

// Filtered white noise with a falling envelope.
function noise(at, length, gain, type, freq, q = 1) {
  const t = c.currentTime + at
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  src.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain
  src.connect(f).connect(g).connect(master()); src.start(t)
}

const N = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 }

const counterBell = () => bell(1480, 0, 0.3, 1.6)

const pencilTally = () => {
  ;[0, 0.1, 0.2, 0.3].forEach((at) => noise(at, 0.07, 0.35, 'bandpass', 3600, 0.8))
  noise(0.45, 0.16, 0.35, 'bandpass', 3000, 0.7)
  // then the card-shuffle sample at +0.75 s
}

const cashRegister = () => {
  noise(0, 0.05, 0.6, 'lowpass', 900); noise(0.05, 0.09, 0.4, 'lowpass', 500)
  bell(2093, 0.12, 0.2, 1.1); bell(2637, 0.12, 0.14, 1.1)
  noise(0.35, 0.18, 0.4, 'lowpass', 400)
}

const vibesTaDa = () => {
  ;[N.G4, N.C5, N.E5, N.G5].forEach((f, i) => vibe(f, i * 0.11, 0.18, 1.2))
  ;[N.C5, N.E5, N.G5, N.C6].forEach((f) => vibe(f, 0.6, 0.14, 2.4))
}
```

## Build plan

This was the plan when work stopped. Nothing below exists yet.

1. **Cues: `apps/web/src/sounds.ts`, pure and unit tested.**
   - **Snapshot:** `snapshotOf(view)` records the deal (round number and redeals), the feed length, the status, and whose turn it is.
   - **Cues:** `cuesFor(previous, view)` returns cues like `{ sound, mine, cards? }`:
     - new feed events give draw, discard, meld (with the card count), pickup, and canasta (after its meld or pickup);
     - your turn starting gives a cue (status `playing`, the current player is you, and the turn or the deal changed);
     - status going to `roundOver` or `gameOver` gives that cue. Game over replaces round over; don't play both.
   - **No catch-ups:** no previous snapshot (first view or reconnect) means no cues. More than `MAX_ANIMATED_EVENTS` new events (`effects.ts`) means no event cues either, matching the animations.
   - **Gating:** `audible(cue, level)`. Turn, round over and game over need step 1 or more, your own moves step 2, everyone else's moves step 3.
2. **Player: `apps/web/src/soundPlayer.ts`.**
   - **Unlock:** one `AudioContext`, created and resumed on the first `pointerdown` or `keydown` anywhere (browsers block audio before a gesture). Before that, play nothing; don't queue.
   - **Loading:** decode the six MP3s once, at unlock.
   - **Output:** two paths into the speakers, mine at full volume and others quieter and muffled.
   - **Sequencing:** when one update brings several cues, stagger them. For example, the opponent's discard plays, then your turn bell about 0.3 s later.
   - **Tests:** the test environment (jsdom) has no `AudioContext`, so the player must do nothing there without throwing.
3. **`TableSounds` component**, next to `<TableEffects view={view} />` in `Table.tsx`. It keeps the previous snapshot in a ref, as `TableEffects` does, and plays the audible cues.
4. **Settings:**
   - **Storage:** add `loadSoundLevel()` and `saveSoundLevel()` to `storage.ts`, with key `canasta:soundLevel`, default 2.
   - **State:** `Table` holds the level and passes it to `TableSounds` and the button.
5. **`SoundButton` component**, built from the mockup:
   - the icon button, last in `.gameTools`, with `aria-expanded`;
   - the panel, with the range input (0 to 3, `aria-valuetext` set to the step name), the four labels under it, the hint, the test sound and the chart link;
   - the chart in a `<dialog>`, a bottom sheet under 600 px;
   - the panel closes on Escape or a click outside it.
6. **Tests:**
   - `cuesFor` and `audible`, using views from `test/fixtures.ts`;
   - storage;
   - `SoundButton`: the slider changes the step and the label, and the chart opens with the right column shaded.
7. **Then:**
   - listen on a real phone, an iPhone especially, and check the silent switch mutes it;
   - mark the todo item done;
   - run `npm run typecheck`, `npm run lint`, `npx prettier --check .` and `npm test` from the repo root. The project has no CI.

## Notes

- The tutorial also renders `Table`, so it would get the button and the sounds. Decide whether that's wanted.
- The made-in-browser sounds are sketches. Any of them can be swapped later for a CC0 recording from Freesound.org (filter by license). Avoid the BBC sound effects archive: its license doesn't allow commercial use.
- Every UI change in this project gets an agreed mockup first. This one has it, the sound settings mockup linked above.
