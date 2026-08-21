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
src/api.js       The Web RCS WebSocket: envelope, keepalive, reconnect, and the
                 small slice of device state feedbacks need.
src/actions.js   The Command action plus discrete ones. All funnel through run().
src/presets.js   The preset library — this is what populates a Stream Deck.
src/feedbacks.js What can honestly be shown, which is less than it looks.
src/variables.js Definitions are an OBJECT keyed by id.
test/smoke.mjs   32 checks. No network, no test runner.
```

## The rules that matter

**Never edit `src/lang.js`.** It is generated. A second transcription of the
grammar would drift the first time a keyword moved and nothing would notice —
which is exactly what happened to a hand-mirrored protocol file elsewhere in
this fleet.

**Every device write goes through `plan()`.** That keeps one place where a
command becomes paths, and keeps it testable without Companion.

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
- **`runEntrypoint` does not exist in base 2.x.** Default-export the class and
  re-export `UpgradeScripts`. A 1.x call still runs under a unit test while
  `companion-module-build` fails — `npm run package` is the only check.

## Testing

`npm test` covers the planner with golden device paths, and the module surface
loaded against the real `@companion-module/base` via a recording harness.
`npm run package` is a separate, necessary check.

There is no test against a device or against Companion itself. Every path the
planner emits was verified on a physical Aquilon C on firmware 6.2.73 — see
`docs/PATHS.md` in the mynah repo — but **no button has been pressed on real
hardware**. Say so in any release note.

## No CI, deliberately

There is no `.github/` here. Actions minutes are billed on private repositories,
and the same call was made for the other private repo in this family. The copied
workflow would also have failed as-is: it ran `node test/smoke.mjs` with no
`npm install`, which suited openrcs's dependency-free protocol test but not this
one, which loads the real `@companion-module/base`.

If this ever goes public, add the fleet workflows back and put an `npm ci` step
before the test.
