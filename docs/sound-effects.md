# Interface Sound Effects (SFX)

How this app produces its interaction sounds, and how to reuse the same system
in another project.

## The idea in one paragraph

Every sound is **synthesised in the browser with the Web Audio API** — there are
no audio files and no audio library. One small module defines a palette of named
sounds. One component, mounted once at the app root, listens for clicks and
keystrokes on the whole document and picks the right sound automatically, so
individual buttons and inputs need no wiring. Sounds are short (≤ 0.4s) and
quiet, so they confirm an action without drawing attention.

## Files

| File | Role | Portable as-is? |
| --- | --- | --- |
| `Client/src/lib/sound.js` | The engine: audio context, the `tone()` helper, the `SOUNDS` palette, throttling, on/off switch. Plain JS, no dependencies. | Yes — copy unchanged |
| `Client/src/components/InteractionSounds.jsx` | Global listener. Maps clicks, typing and toasts to sounds. Mounted once in `Client/src/pages/Layout.jsx`. | Mostly — see "Project-specific parts" |
| `Client/src/components/OpenSound.jsx` | Drop inside a dialog/sheet to play `open` when it mounts. | Yes |

## The sound palette

All sounds are built from `tone()`: one oscillator with a fast attack
(≤ 12ms), an exponential decay, and an optional pitch glide (`freq` → `to`).

| Name | When it plays | Shape | Gain | Throttle (`gap`) |
| --- | --- | --- | --- | --- |
| `tap` | Any click on a button, link, tab, menu item, select | 1400→900 Hz triangle, 35ms | 0.05 | 40ms |
| `type` | Each character / Backspace / Delete in a text field | 2100–2600 Hz (randomised) triangle, 18ms | 0.018 | 28ms |
| `toggleOn` | Switch, checkbox or radio turning on | 620→940 Hz sine, 70ms (rises) | 0.06 | 60ms |
| `toggleOff` | Switch or checkbox turning off | 940→620 Hz sine, 70ms (falls) | 0.05 | 60ms |
| `open` | A dialog or sheet appears | 420→700 Hz sine, 100ms | 0.045 | 120ms |
| `success` | `toast.success` | C6 then E6 (two rising notes) | 0.06 | 300ms |
| `error` | `toast.error` | 330 Hz then 247 Hz triangle (two falling notes) | 0.07 | 300ms |
| `send` | The user posts a chat message | 520→1180 Hz sine, 110ms (upward swoosh) | 0.05 | 150ms |
| `receive` | Someone else's message arrives live | 780 Hz then 1040 Hz | 0.05 | 250ms |
| `notification` | Assigned a task / @mentioned | A5 + E6, 350ms each | 0.18 | 1500ms |

Everything passes through a master gain of `0.55`.

## Design rules (why it feels good, not annoying)

1. **Quiet and short.** UI sounds sit at gain 0.02–0.07 and under 120ms. Only
   the notification chime is louder and longer, because it has to be noticed.
2. **Direction carries meaning.** Rising pitch = on / open / sent / success.
   Falling pitch = off / error. Nobody has to learn it.
3. **Frequent sounds are the quietest.** Typing is the faintest sound in the
   app, and its pitch is randomised so fast typing doesn't drone.
4. **Every sound is throttled.** `gap` drops repeats of the same sound inside a
   short window, so rapid clicks or a burst of toasts never stack.
5. **One sound per action.** If an action already makes its own sound, the
   generic click is silenced with `data-sfx="none"` (see below).
6. **Users are in control.** Two separate settings: "Interface sounds" and
   "Notification chime", each with a Preview button
   (`Client/src/components/settings/NotificationSettings.jsx`).
7. **Disabled controls are silent**, and so are modifier shortcuts (Ctrl/Cmd/Alt)
   and read-only fields.

## How sounds get triggered

**Automatically (no code per component)** — `InteractionSounds` listens on
`document` in the capture phase:

- `pointerdown` on anything matching the `CLICKABLE` selector → `tap`, or
  `toggleOn` / `toggleOff` for switches, checkboxes and radios (based on the
  state they are moving *to*).
- `keydown` in a text field → `type`.
- New `react-hot-toast` toasts → `success` / `error`, once per toast id.

**Per-element override** with the `data-sfx` attribute (it is looked up on the
element or any ancestor):

```jsx
<button data-sfx="none">Post</button>      // silent — the action plays its own sound
<button data-sfx="success">Finish</button> // play a specific named sound instead of tap
```

**Manually**, for events that are not a click:

```js
import { sfx } from "../lib/sound";

sfx("send");                                        // on posting a message
if (comment.userId !== user?.id) sfx("receive");    // live message from someone else
```

```jsx
<OpenSound />   // inside a dialog, plays "open" on mount
```

## Public API of `sound.js`

| Export | Use |
| --- | --- |
| `sfx(name)` | Play an interface sound. Respects the "Interface sounds" setting. |
| `setUiSoundsEnabled(bool)` | Turn interface sounds on/off globally. |
| `playNotificationSound()` | The chime. Ignores the interface setting; the caller checks its own setting. |
| `previewSound(name)` | For settings previews; plays even when interface sounds are off. |

## Browser behaviour to know about

Browsers block audio until the user interacts with the page. `sound.js` resumes
the audio context on the first `pointerdown` / `keydown`, and `play()` does
nothing unless the context is `running`. In practice the very first interaction
after page load may be silent, and a notification that arrives before any
interaction will not chime. This is expected, not a bug.

## Reusing this in another project

1. Copy `sound.js` and `OpenSound.jsx` unchanged.
2. Copy `InteractionSounds.jsx` and adapt the two project-specific parts below.
3. Mount `<InteractionSounds />` **once**, at the root layout.
4. Add `<OpenSound />` inside each dialog / drawer / sheet.
5. Call `sfx("send")`, `sfx("receive")` etc. at non-click events.
6. Add `data-sfx="none"` to any button whose action already produces a sound.
7. Add a settings toggle that calls `setUiSoundsEnabled`.

### Project-specific parts of `InteractionSounds.jsx`

- **Where the on/off preference lives.** Here it is read from Clerk:
  `user.unsafeMetadata.notificationPrefs.uiSounds`. Replace with the new
  project's store (localStorage, Redux, a user-settings API, …).
- **Toast library.** Here it is `react-hot-toast` (`useToasterStore`). For
  another library (sonner, react-toastify, …) either hook into its store or
  call `sfx("success")` / `sfx("error")` from a small wrapper around its
  `toast` functions.

For a non-React project, `sound.js` still works as-is; rewrite the two
`document.addEventListener` handlers from `InteractionSounds.jsx` as plain JS.

### Adding a new sound

Add an entry to `SOUNDS` in `sound.js`, keeping to the rules above:

```js
delete: { gap: 200, play: (a) => tone(a, { freq: 500, to: 260, dur: 0.09, gain: 0.05, type: "triangle" }) },
```

Then trigger it with `sfx("delete")` or `data-sfx="delete"`.

## Prompt to give Claude in a new project

> Add interface sound effects to this project, using the same system as my
> reference repo `<GITHUB_REPO_URL>`. Read `docs/sound-effects.md` there first,
> then `Client/src/lib/sound.js`, `Client/src/components/InteractionSounds.jsx`
> and `Client/src/components/OpenSound.jsx`.
>
> Requirements:
> - Synthesise every sound with the Web Audio API. No audio files, no audio library.
> - Port `sound.js` unchanged, including the sound palette, gains, durations and throttle gaps.
> - Mount one global listener at the app root so clicks, toggles and typing get
>   sounds automatically. Do not add sound calls to individual buttons.
> - Support the `data-sfx="none"` / `data-sfx="<name>"` override attribute.
> - Play `open` when dialogs/drawers appear, `success` / `error` on toasts, and
>   `send` / `receive` wherever this project has messaging.
> - Adapt the two project-specific parts to this codebase: where the user's
>   sound preference is stored, and which toast library is used.
> - Add a settings toggle for "Interface sounds" with a Preview button.
> - Make sure no action plays two sounds: silence the generic click with
>   `data-sfx="none"` where the action has its own sound.
>
> Before writing code, tell me which toast library and settings storage you
> found here and how you will hook into them.
