> **AI-assisted project.** This codebase was created with [Claude](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author.
> The commands it builds have been checked on a physical Aquilon C, and the module has run end
> to end in Companion 5.0.1 against the AW LivePremier Simulator, but no button has been pressed
> against a real device yet, or on a physical Stream Deck. See [Status](#status).

# companion-module-mynah

Drive an Analog Way LivePremier (Aquilon) from Bitfocus Companion in
[Mynah](https://github.com/stoatworks-labs/mynah) command syntax, which reads like this:

```
Recall Screen 1 Memory 5
Store Master 12 If Screen 1 + 3 Category Source + Position
Take Screen 1 Thru 4
```

One action takes any Mynah command, so a button says what it does in words
instead of hiding it behind a numeric opcode. There are separate actions too, if
you'd rather pick from dropdowns.

<!-- downloads:start -->

## Download

**[v1.1.2](https://github.com/stoatworks-labs/companion-module-mynah/releases/tag/v1.1.2)**

This release contains:

- [`companion-module-mynah-pkg.tgz`](https://github.com/stoatworks-labs/companion-module-mynah/releases/latest/download/companion-module-mynah-pkg.tgz) — npm package, 36 KB
- [`mynah-1.1.2.tgz`](https://github.com/stoatworks-labs/companion-module-mynah/releases/download/v1.1.2/mynah-1.1.2.tgz) — npm package, 36 KB

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-mynah/releases](https://github.com/stoatworks-labs/companion-module-mynah/releases).

<!-- downloads:end -->

## Why this and not the Stream Deck plugin

Mynah also comes with an Elgato Stream Deck plugin, and if you're already running
Companion, this replaces it. Companion grabs the Stream Deck for itself, so the
two can't both own the hardware, and Companion brings pages, variables, feedbacks
and every other surface it supports, none of which the Elgato plugin does.

This module doesn't talk to the Mynah web tool. It's a separate client of the
switcher: it bundles the same parser and compiler and opens its own Web RCS
WebSocket, so neither needs the other running.

## Populating a deck

Most of the work here is done by the presets. Drag them in from Companion's
preset panel:

| Section         | What is in it                                               |
| --------------- | ----------------------------------------------------------- |
| Transport       | Take, per screen and across screens 1–4                     |
| Screen memories | Screens 1–4 × memories 1–12, lit when that memory is loaded |
| Master memories | Master 1–24                                                 |
| Layer memories  | Screens 1–2, layer 1, memories 1–8                          |
| Indicators      | Which screens are selected in the vendor Web RCS            |
| Store           | Screens 1–4 × memories 1–4, deliberately a different colour |
| Command builder | The slot keys and controls for building a command by hand   |
| Macros          | Twenty-four slots for commands the builder has parked       |
| Status          | Connection, and the last command's result                   |

That's 186 ready-made buttons, enough to fill pages without typing a single
command. For anything outside those ranges, drop a **Command** button on a key
and type it in.

## The command builder

You can build a whole command out of key presses, without typing anything or
opening a configuration dialog.

Press a key and the slots offer you the verbs. Press `Recall` and they offer
Screen, Aux, Master and Multiviewer; press `Screen` and they list the screens,
with a `123…` key that takes you to the keypad for anything longer or for a
range. **Fire** lights up as soon as what you've built compiles, and **Save**
parks it on one of twenty-four macro keys, which label themselves.

A Companion module can't make a surface change page, so instead of the page
changing, the key faces do. Each slot key reads its text from a variable that the
module rewrites on every press. Drag the slot presets onto a page in order, add
Back, Home, More, Fire and Save, and tell the connection how many slots you've
laid out.

The keypad has `Thru`, `+` and `-` wherever a range would parse, so
`Take Screen 1 Thru 4 - 3` is only a handful of presses. It leaves them off for a
memory number, where the grammar only takes a single slot.

`Set` (live layer control) isn't in the builder, because the compiler refuses it
without live buffer state, and this module doesn't track that. `Label` isn't there
either: it needs a quoted string, and a control surface has no way to type one.
See [docs/BUILDER.md](docs/BUILDER.md).

## Connecting

Point it at the device on port 80 or at the LivePremier simulator on 3000. It
speaks the Web RCS WebSocket (the one the vendor's own browser UI uses), so
there's nothing to install on the switcher, no five-client cap, and the module
sees any changes someone makes in the Web RCS.

The socket has **no authentication**. Anyone who can reach the port can drive the
switcher, so keep it on a network you trust.

## Two things worth knowing

**A recall never reaches program by accident.** A bare `Recall` goes to Preview
and a bare `Store` takes from Program, which matches the device's own default.
Getting to air always takes an explicit `Program` or a `Take`.

**A button has no sticky scope.** The web tool has a selection that sticks around
between commands, and a control surface doesn't, on purpose. A key whose meaning
depends on state you can't see will fire at the wrong screen sooner or later, so
every button command has to name its own scope. One that doesn't gets refused
when you set it up, not halfway through a show.

## Feedback is narrower than you might expect

There's no "in program" feedback, and that's on purpose. The device reports which
memory sits in a buffer keyed `A`/`B`/`C`, and preview and program are just names
for whichever buffer is pending or live at the time. On a real Aquilon C that
mapping was seen to differ between screens at the same moment, with S1 on `A`
while S2–S4 were on `B`. Sorting that out needs take state this module doesn't
track, so what you get is "this memory is loaded on this screen", which is at
least true.

## Installing

Point Companion → Settings → Developer modules path at a checkout of this repo.
Or run `npm run package` and install the `.tgz` it makes.

```bash
npm install
npm test      # 56 checks, no network
npm run package
```

## Keeping the grammar in sync

`src/lang.js` is generated, not written by hand. It's the Mynah language core,
bundled from its TypeScript source, so a command means the same thing here as it
does in the web tool. The copy here was last re-synced on 2026-09-04, and mynah's
grammar has moved on since (Midra 4K / Alta 4K, `$` and `@` variables, and the
save-mode fix in [Status](#status)). To update it:

```bash
npm run build:lang     # in the mynah repo
npm run sync:lang      # here
```

The smoke tests check golden device paths, so if the two drift apart you find
out from a failing test rather than from a switcher doing the wrong thing.

## Status

**v1.1.2: field testing.** v1.1.2 is a dependency release (`ws` 8.22.0). v1.1.1 fixed the
module crashing on load when installed from the release package: the About block read
`package.json` from a path that only exists in a checkout. I drove the v1.1.0 code end to end
inside Companion 5.0.1, loaded from a checkout on the developer modules path, against the AW
LivePremier Simulator. The module loads and initialises cleanly, its 186 presets populate,
buttons were pressed on a real grid, the slot keys relabel themselves at every step, and the
simulator's own socket showed the golden paths arriving (a preset recall onto preview and an
`xTake`), built by pressing keys. The module surface is exercised against the real
`@companion-module/base`.

**The command planner is verified against real hardware.** It's a copy of
[mynah](https://github.com/stoatworks-labs/mynah)'s, and on 2026-09-09 every path that
grammar emits was sent to a physical Aquilon C on firmware 6.2.73 and got an answer, the
memory paths and the audio matrix included, with no `E12`. So the commands this module builds
are ones a real device is known to accept, bar one. On 2026-09-12 mynah found that its master
store from preview sent the save mode as `SAVE_FROM_PVW`, where the device wants
`SAVE_FROM_PRW`, and that the wrong spelling is ignored without an error, so the store came
from program instead. Mynah fixed it in v1.4.0. This module's copy was last re-synced before
that, so a `Store Master … Preview` from here still stores from program until `src/lang.js` is
re-synced.

**No button has been pressed against a real device, or on a physical Stream Deck.**
Everything above ran either in Companion against a simulator, or at hardware through a
separate test harness. Those two halves haven't been joined up yet, and joining them is the
next thing to try.

Not affiliated with Analog Way or with Bitfocus.
