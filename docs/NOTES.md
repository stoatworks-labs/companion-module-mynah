# Notes

Working notes for this repo: status, decisions, and the traps that have actually bitten.
Migrated out of Claude Code's memory on 2026-08-24, so they are written in the first
person and dated by when each thing was learned — that date is usually the useful part.

Cross-cutting notes that are not specific to this repo live in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).

*companion-module-mynah — Bitfocus Companion module driving LivePremier with Mynah command syntax; v1.1.0 adds an on-surface COMMAND BUILDER, verified end-to-end in Companion 5.0.1 against the AW simulator; PUBLIC repo, no button pressed against real hardware*

`~/projects/companion/companion-module-mynah`, **PUBLIC** on GitHub
(`stoatworks-labs/companion-module-mynah`), branch `main`, **v1.1.0**, MIT.
Built 2026-08-21 as the Stream Deck answer for [mynah](https://github.com/stoatworks-labs/mynah/blob/main/docs/NOTES.md) (`mynah`).

**Companion, not Elgato.** Companion claims the Stream Deck itself, so the two
plugins cannot both own the hardware — and Companion brings pages, variables and
feedbacks. Mynah's own Elgato plugin still exists in its `streamdeck/` dir; this
supersedes it for anyone already running Companion.

It is an **independent client of the switcher**: bundles Mynah's compiler, opens
its own Web RCS WebSocket, does not talk to the web tool.

## The grammar is vendored, not transcribed

`src/lang.js` is **GENERATED** — `npm run build:lang` in the mynah repo emits
`dist-lang/mynah-lang.mjs` from `src/lang/index.ts`, then `npm run sync:lang`
here copies it in with a provenance header. Never hand-edit it; never let
prettier touch it (it is in `.prettierignore`, and prettier reformatting it once
already made sync produce a spurious diff). Golden device-path tests catch drift.
This directly answers the hand-mirroring problem flagged in
[companion modules](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/project_companion_modules.md) for animATEM.

## Populating a deck = the preset library

~100 presets across sections: Transport (take per screen + 1 Thru 4), Screen
memories (S1-4 x M1-12, with a loaded feedback), Master (1-24), Layer (S1-2
layer 1, M1-8), Indicators (vendor Web RCS selection), Store (red), Status.
Base 2.1 also has a **`template` preset group** that generates a matrix of
buttons from one definition — not used, because its `$(local:…)` reference
syntax could not be verified without a running Companion. Worth revisiting.

## Deliberate limitations — do not "fix" these

- **No sticky scope on a button.** `Select` and `Clear` are refused with an
  explanatory error. A key whose meaning depends on invisible state eventually
  fires at the wrong screen.
- **No "on air" feedback.** Preview/program names buffers A/B/C and the mapping
  differs *between screens on the same device* ([livepremier memory banks](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_livepremier_memory_banks.md)).
  The honest feedback is "memory is loaded on this screen".

## Traps confirmed against base 2.1.2 source, not memory

- **`setVariableDefinitions` really does throw on an array** — it wants an
  object keyed by variable id. **I shipped an array first**, and my own test
  stub had the check *inverted* so it passed. Verify stubs against
  `node_modules`, never against recollection.
- **`setPresetDefinitions(structure, definitions)` takes TWO args** —
  confirmed in `base.d.ts`. ⚠️ **`companion-module-openrcs` still calls it with
  ONE arg and 1.x `category` fields**, so its presets almost certainly never
  appear in the UI. Unverified but very likely a live bug worth fixing.
- `checkAllFeedbacks()`, `self.label` in preset variable refs, and no
  `runEntrypoint` — all observed. `npm run package` passes.

**No CI and no Dependabot**, matching [livepremier plus](https://github.com/stoatworks-labs/livepremier-plus/blob/main/docs/NOTES.md) (`livepremier-plus`): Actions
minutes are billed on private repos. The copied `test.yml` would also have
failed — it ran the smoke test with no `npm install`, which suited openrcs's
dependency-free test but not this one.

## VERIFIED IN COMPANION 5.0.1, 2026-08-21

Loaded from the developer modules path and confirmed in the running app:

- The module is listed and addable.
- `Instance/Connection/Mynah/Entrypoint Module initialized successfully` — no
  errors, which also proves the variable-definitions shape is right, since an
  array would have thrown and failed `init()`.
- **The ~100 presets populate**, so the two-argument
  `setPresetDefinitions(structure, definitions)` shape is correct and the
  sections/groups render. This is the shape [companion openrcs](https://github.com/stoatworks-labs/companion-module-openrcs/blob/main/docs/NOTES.md) (`companion-module-openrcs`) does
  NOT use.

## END-TO-END VERIFIED against the simulator, 2026-08-21

A **Companion button press drives the device.** Built a button, added actions,
pressed Test, and watched the simulator's socket:

- `Take Screen 1` → `device/screenAuxGroupList/items/S1/control/pp/xTake = true`
- `Store Master 12 If Screen 1 + 3 Category Source + Position` → all six ops,
  and the device read back `screenFilter ["S1","S3"]`,
  `categoryFilter ["SOURCE","POS"]`, master slot 12 `isValid=true`.
- The preset panel shows **123 presets** in seven named sections.

That run found the `parseVariablesInString` bug (v1.0.3) — see
[companion module traps](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_companion_module_traps.md). **Nothing but running it in Companion
could have.**

**Still not done: no button pressed against real hardware.** The Aquilon was
unreachable — the `en19` USB adapter carrying the 192.168.2.x AV network
vanished from the host, which also retroactively explains the device "going
unreachable" mid-test earlier in [mynah](https://github.com/stoatworks-labs/mynah/blob/main/docs/NOTES.md) (`mynah`). Not a device fault; that
adapter dropped out twice in one day.

32 checks pass; `npm run package` builds. The command planner is the same code
verified on a physical Aquilon C. See [companion module traps](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_companion_module_traps.md) and
[companion module discoverability](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_companion_module_discoverability.md).


---

## v1.1.0 — the on-surface command builder, 2026-08-22

Build a whole Mynah command out of key presses. **UNCOMMITTED** as of writing;
186 presets (was 123), 56 checks, packages clean.

**The asked-for design does not exist: a module cannot change what page a
surface shows.** Not on `InstanceBase`, not via a custom variable, not in the
internal-action catalogue offered to presets — see
[companion surface page control](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_companion_surface_page_control.md) for the introspection. So the page
stays put and the **faces** change: slot keys read `$(label:b7)` and the module
rewrites the variables and re-checks the feedbacks on every press. The operator
sees a page-per-step wizard; nothing pages.

- `src/menu.js` — the step graph, data only. **Written down, not derived**:
  `completions()` is a prefix filter over the keyword list, not a next-token
  oracle, and `parseCommand` is a flat order-free clause loop with no tree to
  walk out of.
- `src/builder.js` — pure state machine; a press returns an *effect*.
- `src/macros.js` — 24 macro slots as JSON in the connection config, written
  with `saveConfig()`, so they survive a restart and ride a Companion export.

⚠️ **The drift guard is a path walk**: the suite walks every path the graph can
emit — **63,850 distinct commands** — and hands each to `plan()`. It found two
real holes immediately: **`Memory 1 Thru 3` does not parse** (ranges belong to
*targets* — screen/aux/layer/multiviewer — never to a memory slot, so the
keypad hides `Thru + -` there), and **`If` with no filter after it** (the first
pass of the filter loop must have no Done).

**Fire is not the last step.** It lights whenever `plan()` says the line
compiles, which is usually before the menu stops asking — the honest reading of
an order-free grammar, and fewer presses.

Left out on purpose: **`Set`** (compile() refuses it without `DeviceFacts`;
this module tracks no buffer state and the socket pushes only changes),
**`Label`** (needs a quoted string; no text entry on a surface), Select/Clear
(already refused).

### Fixed on the way in
- **The escaped `\n` bug was live here** — 8 sites across `presets.js` and
  `commands.js`, so all 123 preset buttons drew `TAKE\nS1` literally. Fixed;
  the suite now pins `keyTitle` to a real newline.
- **The vendored grammar was a minor version behind** — `npm run sync:lang`
  brought `Set`, `At`, `Still/None/Colour` and the attribute keywords in from
  mynah v1.3.3. Clean: all existing golden paths still passed.

### VERIFIED END-TO-END in Companion 5.0.1, 2026-08-22

Against the **AW LivePremier Simulator** (already running on :3000; Companion
already running on :8000 with `--extra-module-path=~/Projects/companion`).
Buttons wired by hand, pressed via `POST /api/location/...`:

- The slot keys **relabel themselves** at every step, on a real button grid.
- Fire lit the moment the line compiled.
- The **simulator's own socket** showed
  `device/presetBank/control/load/slotList/items/3/screenList/items/S1/presetList/items/PREVIEW/pp/xRequest = true`
  and `device/screenAuxGroupList/items/S1/control/pp/xTake = true` — the golden
  paths, built by pressing keys.
- The keypad worked: `123…` → digits accumulate → `⏎` commits.
- A macro saved from a key landed in Companion's db:
  `"macros": "[null,{\"line\":\"Take Screen 1\",\"label\":\"Take\\nS1\"}]"`.

**Still not done: no button pressed against real hardware.**
