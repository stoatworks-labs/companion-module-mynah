> **AI-assisted project.** This codebase was created with [Claude Code](https://claude.com/claude-code).
> The command planner is the same code verified against a physical **Aquilon C** on firmware
> 6.2.73, and the module surface is exercised against the real `@companion-module/base`. But
> **this module has never been loaded into a running Companion**, and no button on a Stream Deck
> has ever been pressed to fire one of its presets. See [Status](#status).

# companion-module-mynah

Drive an Analog Way LivePremier (Aquilon) from Bitfocus Companion using
[Mynah](https://github.com/stoatworks-labs/mynah) command syntax.

```
Recall Screen 1 Memory 5
Store Master 12 If Screen 1 + 3 Category Source + Position
Take Screen 1 Thru 4
```

One action takes any Mynah command, so a button says what it does in words
rather than hiding behind a numeric opcode. There are discrete actions too, for
people who would rather pick from dropdowns.

<!-- downloads:start -->

## Download

**[v1.0.3](https://github.com/stoatworks-labs/companion-module-mynah/releases/tag/v1.0.3)**

This release contains:

- [`mynah-1.0.3.tgz`](https://github.com/stoatworks-labs/companion-module-mynah/releases/download/v1.0.3/mynah-1.0.3.tgz) — npm package, 27 KB

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-mynah/releases](https://github.com/stoatworks-labs/companion-module-mynah/releases).

<!-- downloads:end -->

## Why this and not the Stream Deck plugin

Mynah also ships an Elgato Stream Deck plugin, and this supersedes it for
anyone already running Companion. Companion claims the Stream Deck itself, so
the two cannot both own the hardware — and Companion brings pages, variables,
feedbacks and every other surface it supports, which the Elgato plugin does
not.

This module does **not** talk to the Mynah web tool. It is an independent
client of the switcher: it bundles the same parser and compiler and opens its
own Web RCS WebSocket. Neither needs the other running.

## Populating a deck

The preset library is the point. Drag from Companion's preset panel:

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

That is a bit over a hundred ready-made buttons — enough to fill pages without
typing a command by hand. For anything past those ranges, drop a **Command**
button on a key and type it.

## The command builder

Build a whole command out of key presses — no typing, no configuration dialog.

Press a key and the slots offer the verbs; press `Recall` and they offer
Screen, Aux, Master, Multiviewer; press `Screen` and they list the screens,
with a `123…` key to the keypad for anything longer or for a range. **Fire**
lights the moment what you have built compiles, and **Save** parks it on one of
twenty-four macro keys that label themselves.

A Companion module cannot make a surface change page — so the page does not
change, the faces do. Each slot key reads its text from a variable the module
rewrites on every press. Drag the slot presets onto a page in order, add Back,
Home, More, Fire and Save, and tell the connection how many slots you laid out.

The keypad carries `Thru`, `+` and `-` wherever a range parses, so
`Take Screen 1 Thru 4 - 3` is a handful of presses. It does not offer them on a
memory number, where the grammar takes a single slot.

`Set` — live layer control — is not in the builder: the compiler refuses it
without live buffer state this module does not track. `Label` is not there
either, because it needs a quoted string and a control surface has no text
entry. See [docs/BUILDER.md](docs/BUILDER.md).

## Connecting

Point it at the device on **port 80**, or the LivePremier simulator on **3000**.
It speaks the Web RCS WebSocket — the socket the vendor's own browser UI uses —
so nothing is installed on the switcher, there is no five-client cap, and the
module sees changes a human makes in the Web RCS.

The socket is **unauthenticated**. Anyone who can reach the port can drive the
switcher; keep it on a trusted network.

## Two things worth knowing

**A recall never reaches program by accident.** An unqualified `Recall` goes to
Preview and an unqualified `Store` takes from Program, matching the device's own
default. Reaching air always costs an explicit `Program` or a `Take`.

**A button has no sticky scope.** The web tool has a selection that persists
between commands; a control surface deliberately does not. A key whose meaning
depends on invisible state is a key that eventually fires at the wrong screen,
so every button command must name its own scope — and one that does not is
refused when you configure it, not during a show.

## Feedback is narrower than you might expect

There is no "in program" feedback, and that is deliberate. The device reports
which memory sits in a buffer keyed `A`/`B`/`C`, and preview/program are names
for whichever buffer is currently pending or live. On a real Aquilon C that
mapping was observed **differing between screens at the same moment** — S1 on
`A` while S2–S4 were on `B`. Resolving it needs take state this module does not
track, so what you get is an honest "this memory is loaded on this screen".

## Installing

Companion → Settings → Developer modules path, pointed at a checkout of this
repo. Or `npm run package` and install the resulting `.tgz`.

```bash
npm install
npm test      # 32 checks, no network
npm run package
```

## Keeping the grammar in sync

`src/lang.js` is **generated**, not written — it is the Mynah language core
bundled from its TypeScript source, so a command means exactly the same thing
here as in the web tool. To update it:

```bash
npm run build:lang     # in the mynah repo
npm run sync:lang      # here
```

The smoke tests assert golden device paths, so drift between the two shows up
as a failing test rather than as a switcher doing the wrong thing.

## Status

**v1.0.0.** The command planner is the same code verified against a physical
Aquilon C on firmware 6.2.73, and the module surface is exercised against the
real `@companion-module/base`.

**Not yet run inside Companion, and not against a Stream Deck.** The preset
structure, feedbacks and variables are checked against the library's actual
types and runtime behaviour, but no button has been pressed on real hardware.

Not affiliated with Analog Way or with Bitfocus.
