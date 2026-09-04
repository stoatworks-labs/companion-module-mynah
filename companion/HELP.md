## Mynah — LivePremier command line

Drive an Analog Way LivePremier (Aquilon) with lighting-desk command syntax.

### Setup

Enter the device address and port. Use **80** for a switcher, **3000** for the
LivePremier simulator. The module connects to the Web RCS WebSocket — the same
socket Analog Way's own browser UI uses — and reconnects on its own if the link
drops.

The socket is unauthenticated. Keep it on a trusted network.

### The Command action

Takes any Mynah command. Verb first, then what it acts on:

| Command                                           | What happens                     |
| ------------------------------------------------- | -------------------------------- |
| `Recall Screen 1 Memory 5`                        | Memory 5 into Screen 1's preview |
| `Recall Screen 1 Memory 5 Program`                | Straight to program              |
| `Recall Screen 1 Thru 4 Memory 7`                 | Four screens at once             |
| `Recall Master 12`                                | A whole-desk memory              |
| `Recall Screen 3 Layer 1 Memory 8`                | A layer memory                   |
| `Store Screen 1 Memory 5`                         | Store program into memory 5      |
| `Store Master 12 If Screen 1 + 3 Category Source` | A masked store                   |
| `Take Screen 1`                                   | Transition preview to program    |
| `Label Screen 1 Memory 5 "Wide Open"`             | Name a memory                    |
| `Delete Screen 1 Memory 5`                        | Erase it                         |

Ranges use `Thru`, `+` and `-`: `Screen 1 Thru 8 - 5` is every screen from 1 to
8 except 5. Keywords may be shortened to any unambiguous prefix, so
`R Sc 1 Th 4 Me 7` is the same as the long form.

The field supports Companion variables, so a command can be built at press time.

### Ranges

| Bank           | Memories |
| -------------- | -------- |
| Screen and Aux | 1–1000   |
| Master         | 1–500    |
| Layer          | 1–50     |

Screens are 1–24, auxes 1–96, layers 1–128 plus `Native`. Anything outside is
refused rather than clamped, and the refusal is logged.

### Defaults

An unqualified `Recall` goes to **Preview**; an unqualified `Store` takes from
**Program**, which is the device's own default. Getting to air always takes an
explicit `Program` or a `Take`.

### Scope

Unlike the Mynah web tool, a button has no sticky selection. Every command must
name its own screen. `Select` and `Clear` are refused for that reason.

### The command builder

Build a command out of key presses instead of typing one.

Drag the **Command builder** presets onto a page: the numbered slot keys in
order, then Back, Home, More, Fire and Save. Tell the connection how many slot
keys you laid out — a module is never told how big a surface is.

Press a slot and the faces change to the next set of choices: the verbs, then
what to act on, then a list of screens with a `123…` key to the keypad for
anything longer or for a range. The page never changes; the keys relabel
themselves. **Fire** lights as soon as what you have built compiles, which is
often before the last question is answered — `Take Screen 1` is finished the
moment the screen lands, and the offer of Preview or Program is just an offer.

The keypad carries `Thru`, `+` and `-` wherever the grammar takes a range, and
hides them where it does not. **Back** is an undo, one press at a time.

**Save** asks which of the twenty-four macro slots to park the line on. Macros
live in the connection's own config, so they survive a restart and travel with
a Companion configuration export; each macro key labels itself.

`Set` and `Label` are not in the builder. `Label` needs a quoted string, and a
control surface has no text entry. `Set` — live layer control — needs the
device's current buffer state, which this module does not track; the compiler
would refuse every one, so the builder does not offer them.

### Feedbacks

- **Memory is loaded on a screen** — the memory sits in one of that screen's
  preset buffers. It does not distinguish preview from program: the device
  reports buffers as A/B/C, and which one is preview differs between screens.
- **Connected to the device**
- **Screen is selected in the vendor Web RCS**
- **Builder: what a slot is showing** — colours a slot key by what it currently
  holds. The slot presets ship with one per kind, so an empty slot goes dark
  and a Delete goes red without configuring anything.
- **Builder: the line would fire**
- **Builder: the list has more pages**
- **Macro: the slot holds a command**
