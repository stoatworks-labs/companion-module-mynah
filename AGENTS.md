# AGENTS.md — companion-module-mynah

Onboarding for LLM agents and newcomers.

## What this is

A Bitfocus Companion module driving Analog Way LivePremier over the Web RCS
WebSocket, using [Mynah](https://github.com/stoatworks-labs/mynah) command
syntax. It is an independent client of the switcher — it does not talk to the
Mynah web tool, and neither needs the other running.

## Layout

```
src/lang.js      GENERATED. The Mynah language core, bundled from its TS source.
                 Never edit; run `npm run sync:lang` after rebuilding it there.
src/commands.js  plan() — the only path from a command string to device writes.
                 PURE: imports nothing from Companion, so it is fully testable.
src/menu.js      The command builder's step graph. Data, no Companion imports.
src/builder.js   The state machine over it. PURE: a press returns an effect.
src/macros.js    Saved macros, in the connection config. PURE.
src/api.js       The Web RCS WebSocket: envelope, keepalive, reconnect, and the
                 small slice of device state feedbacks need.
src/actions.js   The Command action plus discrete ones. All funnel through run().
src/presets.js   The preset library — this is what populates a Stream Deck.
src/feedbacks.js What can honestly be shown, which is less than it looks.
src/variables.js Definitions are an OBJECT keyed by id.
test/smoke.mjs   56 checks. No network, no test runner.
docs/BUILDER.md  Why the builder is not a page-per-step wizard, and what is
                 deliberately left out of it.
```

## The rules that matter

**Never edit `src/lang.js`.** It is generated. A second transcription of the
grammar would drift the first time a keyword moved and nothing would notice —
which is exactly what happened to a hand-mirrored protocol file elsewhere in
this fleet.

**Every device write goes through `plan()`.** That keeps one place where a
command becomes paths, and keeps it testable without Companion.

**A module cannot change what page a surface shows.** There is no page or
surface method on `InstanceBase`, no `setCustomVariableValue` to drive one
indirectly, and the internal-action catalogue offered to presets is eight ids
with nothing of the sort among them. So the builder is one page whose FACES
change: slot keys read their text from variables the module rewrites on every
press. Do not go looking for the page API again — see docs/BUILDER.md.

**The builder's step graph is written down, and the walk test is what keeps it
honest.** `completions()` in the language bundle is a prefix filter over the
keyword list, not a next-token oracle, and the parser is a flat clause loop with
no tree to walk out of. The suite walks every path `src/menu.js` can emit —
around 64,000 commands — and hands each to `plan()`. Add a step, and legality is
checked for you; break one, and the suite goes red.

**No sticky scope, ever.** A button whose meaning depends on invisible state
fires at the wrong screen eventually. `Select` and `Clear` are refused.

**Do not add an "on air" feedback.** The device reports memories against
buffers A/B/C; preview/program is a naming of whichever buffer is pending or
live, and it was observed differing _between screens on the same device_.
Without take state, a confident answer here would be a wrong one.

## Traps in @companion-module/base 2.x

All of these fail silently, and all have shipped in this fleet before.

- **`setVariableDefinitions` throws on an array.** It wants an object keyed by
  variable id. An array fails `init()` and leaves a dead connection with no
  actions and no cause. This module got it wrong first time and the test stub
  had the check _inverted_, so it passed — the stub now mirrors the real
  implementation. Verify stubs against `node_modules`, not against memory.
- **`setPresetDefinitions(structure, definitions)` takes TWO arguments.** A 1.x
  `category` field on a definition still loads and the presets simply never
  appear.
- **A bare `checkFeedbacks()` checks nothing** — it forwards `[undefined]`.
  Use `checkAllFeedbacks()`.
- **Preset variable references must use `self.label`**, not a hardcoded module
  id, or they render as raw `$(...)` on a renamed connection.
- **An escaped `\n` in button text renders literally.** Companion splits on a
  REAL newline and does no escape processing, so `` `TAKE\\nS${s}` `` draws as
  `TAKE\nS1` on the key. This module shipped that in eight places and it was
  fixed in 1.1.0; the smoke suite pins `keyTitle` to a real newline.
- **`runEntrypoint` does not exist in base 2.x.** Default-export the class and
  re-export `UpgradeScripts`. A 1.x call still runs under a unit test while
  `companion-module-build` fails — `npm run package` is the only check.

## Testing

`npm test` covers the planner with golden device paths, and the module surface
loaded against the real `@companion-module/base` via a recording harness.
`npm run package` is a separate, necessary check.

`npm run sync:lang` is worth running before adding a grammar-facing feature:
the vendored bundle sat a minor version behind the mynah repo through 1.0.x,
missing `Set`, `At` and the attribute keywords entirely.

### Verified in Companion 5.0.1, against the AW LivePremier Simulator

The builder was driven end to end from real button presses (Companion's HTTP
API pressing real buttons, not a stub): the slot keys relabelled themselves at
every step, Fire lit the moment the line compiled, and the simulator's own
socket showed
`device/presetBank/control/load/slotList/items/3/screenList/items/S1/presetList/items/PREVIEW/pp/xRequest = true`
— the same golden path the smoke suite asserts. A macro saved from a key landed
in Companion's own database via `saveConfig()`.

Two things to know if you repeat that:

- **Companion 5 buttons are LAYERED.** The HTTP `/style?text=` API does not
  reach a layered button's Text element; set it in the Style tab. Presets are
  unaffected — `type: "simple"` presets are converted by Companion and render
  correctly.
- **Preset drag-and-drop does not respond to synthetic mouse events**, so a
  scripted browser cannot lay a page out that way. Add the actions by hand, or
  press with `POST /api/location/<page>/<row>/<col>/press`.

There is no test against a device or against Companion itself. Every path the
planner emits was verified on a physical Aquilon C on firmware 6.2.73 — see
`docs/PATHS.md` in the mynah repo — but **no button has been pressed on real
hardware**. Say so in any release note.

## CI

`test.yml` runs `npm ci`, the smoke suite and `npm run package` — the install is
required here, unlike openrcs's dependency-free protocol test, because these
tests load the real `@companion-module/base`. Packaging is a separate step on
purpose: a module can pass every unit test and still fail to build.

Neither catches an action that throws only when pressed. That class of bug —
see the `parseVariablesInString` entry in the traps list — is why the suite also
greps its own source for known-dead APIs.

## Notes

`docs/NOTES.md` carries this repo's working notes — current status, decisions
already made, and the traps that have actually bitten. Read it before changing
anything non-obvious. Cross-cutting fleet knowledge lives in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).
