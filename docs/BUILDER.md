# The command builder

Design notes for the on-surface command builder: how it works, why it is not
what it first looks like it should be, and what is deliberately left out.

## The idea

Press one key and build a whole Mynah command out of button presses — verb,
then object, then number, then options — without typing anything into
Companion's configuration dialog. Then either fire it, or park it as a macro on
another key.

## What does not work, and why

The obvious shape is "each press loads the next page". **A Companion module
cannot change what page a surface is showing.** This is not a gap in this
module; it is not exposed at all:

- `InstanceBase` in `@companion-module/base` 2.1.3 carries no page or surface
  method. Introspected, not remembered: the whole prototype is
  `checkAllFeedbacks, checkFeedbacks, checkFeedbacksById, createSharedUdpSocket,
getVariableValue, instanceOptions, log, oscSend, recordAction, saveConfig,
setActionDefinitions, setCompositeElementDefinitions, setFeedbackDefinitions,
setPresetDefinitions, setVariableDefinitions, setVariableValues,
subscribeActions, unsubscribeActions, unsubscribeFeedbacks, updateStatus`.
- There is no `setCustomVariableValue` either, so a page number cannot be
  driven indirectly through a custom variable.
- Presets _can_ now carry internal actions, but the catalogue offered to them
  is eight ids — `wait`, `customLog`, `abortButton`, `localVariableSet`,
  `checkExpression`, `buttonPushed`, `buttonCurrentStep`, plus the logic
  building blocks. No surface or page action among them. A shipped preset
  cannot jump pages either.

An operator can of course put a page jump on their own button by hand. What is
unavailable is a module _driving_ one.

## What is done instead: the page stays, the faces change

One page of **slot** keys. Each slot's text is a variable — `$(mynah:b7)` — and
its action is "builder: press slot 7". The module holds the wizard state, and
after every press it rewrites all the slot labels and re-evaluates the slot
feedbacks. The operator sees exactly the page-per-step experience, with no page
flashing, no surface profiles to maintain, and identical behaviour on a Stream
Deck, a web button and Satellite.

The keypad is not a separate mode. When the current step wants a number, the
same slots become `0-9`, `Thru`, `+`, `-`. One page does the whole job.

Fixed keys beside the slots: **Back**, **Home**, **More** (paginate a long
choice list), a read-only **Line** key showing the command so far, **Fire** and
**Save**.

### Fire is not the last step

The Mynah parser is a flat, order-free clause loop rather than a hierarchy: a
verb, then Screen / Aux / Layer / Master / Multiviewer / Memory / Preview /
Program / `If` in any order. So the builder does not march to a terminal state
and then let you fire. **Fire is lit whenever `plan()` says the line compiles**,
and the menu simply keeps offering what else could be added. `Take Screen 1` is
fireable the moment the screen number is entered; adding `Thru 4` afterwards is
allowed, not required. This is the honest reading of the grammar, and it is
fewer presses than a rigid wizard.

## Where the "valid next words" come from

They are written down, not derived. Two things rule out deriving them:

- `completions()` is exported from the language bundle, but it is a **prefix
  filter over the keyword list** — it answers "what could this half-typed word
  become", not "what is legal here". There is no next-token oracle in the
  grammar.
- The parser's `parseCommand` is that flat clause loop, so there is no tree to
  walk out of it. Teaching it to record an expected-token set would be a change
  to the mynah repo with its own release, for eight verbs.

So `src/menu.js` holds an explicit step graph. The guard against it drifting
from the grammar is a test that **walks every path the graph can emit and
asserts `plan()` compiles it** — the same trick `guide.test.ts` uses in the
mynah repo, where every command printed in the guide is executed by the suite.
The menu can therefore be wrong about taste, but not about legality.

## Enumeration does not scale, so the keypad is the default

From the device model: screen 1-24, aux 1-96, **layer 1-128**, multiviewer 1-8;
memory slots **1-1000** for screen and aux, 500 for master, 50 for layer and
multiviewer.

"Then it lists the layers" is 128 buttons. Lists are offered only where the set
is genuinely small — 4 verbs, 5 objects, 2 modes, 14 record-mask categories,
and screens, which paginate. Everything else is the keypad.

The keypad carries `Thru`, `+` and `-` as well as digits, because ranges are
the best thing in this grammar. `Store Screen 1 Thru 4 - 3 Memory 9` is three
extra presses here and a genuinely tedious thing to type by hand; a builder that
could only produce single numbers would be a downgrade from the plain Command
action.

## Slots, and how many

The module cannot know how big the surface is, so **"Builder slots" is a config
field** (4-32, default 12). Choice lists paginate over that many slots; slot
presets are shipped for all 32 so any deck can be laid out. Slots past the
configured count render blank.

## Macros

Save puts the builder into a slot-picking step — the same slot mechanism,
showing the macro slots and their current labels — and the press stores the
line there. Twenty-four slots.

They live as JSON in a config field and are written with `saveConfig()`. That
means they survive a restart and travel with a Companion configuration export.
There is no hidden config field type in base 2.x, so the JSON box is visible,
which also makes a macro set hand-editable and shareable — a fair trade for
what is otherwise a slightly ugly field.

Recall is by slot number, with `$(mynah:macro_7_label)` on the face, **not** a
dropdown of macros. A dropdown's choices are baked into the action definition,
so every save would have to re-emit `setActionDefinitions()`; a numbered slot
whose label is a variable needs nothing re-registered and labels itself.

## Deliberately not in the builder

- **`Set`** — live layer control. The grammar has it as of mynah 1.3, and it is
  the most builder-shaped feature there is. It is out because `compile()`
  refuses it without `DeviceFacts`: live layer parameters are addressed by
  buffer A/B/C, and resolving "program" to a buffer needs take state this
  module does not track. This socket pushes only _changes_, and the one HTTP
  read that would seed a full model is over 100 MB. Offering `Set` in the menu
  while `plan()` refuses every one of them would be worse than not offering it.
  Wiring the facts is its own piece of work, and needs verifying against a
  device — not inferring.
- **`Label`** — needs a quoted string, and there is no text entry on a control
  surface.
- **`Select` / `Clear`** — already refused by `plan()`. They set command-line
  state, and this module has no command line. That refusal is the module's
  no-sticky-scope rule and the builder does not get an exemption.

## One session, for now

The action event carries `surfaceId`, so per-deck builder sessions are
possible. They are not implemented, because variables and feedbacks belong to
the _connection_, not the surface: two decks showing the same page would still
show the same faces, so a genuinely per-surface builder needs a page per
surface as well. One shared session, until someone wants the other thing.

## Files

```
src/menu.js     The step graph. Data, no Companion imports.
src/builder.js  The state machine over it. Pure — press, back, home, more.
src/macros.js   Read/write the macro slots in the connection config.
```

All three are pure and unit-tested without Companion, in the same way
`commands.js` is.
