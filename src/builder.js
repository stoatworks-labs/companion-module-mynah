/**
 * The command builder's state machine.
 *
 * Pure: it imports the step graph and the grammar, and nothing from Companion.
 * A press returns an *effect* (`fire`, `save`, …) rather than doing anything,
 * so the whole of the interaction is testable without a surface.
 *
 * Why this is not a page-per-step wizard: a Companion module cannot change
 * what page a surface shows. There is no page or surface method on
 * `InstanceBase`, no `setCustomVariableValue` to drive one indirectly, and the
 * internal-action catalogue offered to presets carries nothing of the sort. So
 * the page stays put and the faces change — the slot keys read their text from
 * variables this rewrites on every press. See docs/BUILDER.md.
 */

import { STEPS, MACRO_SLOTS } from "./menu.js";
import { plan } from "./commands.js";

/**
 * The keypad, in the order it fills slots.
 *
 * Digits first, then delete and enter, then the range operators — because the
 * list paginates on a small surface and this is the order that survives it.
 * At the default twelve slots the first page is exactly the digits plus
 * delete and enter, and `Thru + -` are one More away. At fifteen or more the
 * whole keypad is on one page.
 */
const DIGITS = [
  ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => ({
    label: d,
    kind: "digit",
    act: { type: "digit", d },
  })),
  { label: "⌫", kind: "operator", act: { type: "backspace" } },
  { label: "⏎", kind: "action", act: { type: "enter" } },
];

/** The range operators, offered only where a range parses. */
const RANGE_OPS = [
  { label: "Thru", kind: "operator", act: { type: "op", op: "Thru" } },
  { label: "+", kind: "operator", act: { type: "op", op: "+" } },
  { label: "−", kind: "operator", act: { type: "op", op: "-" } },
];

const keypadFor = (step) => (step.range ? [...DIGITS, ...RANGE_OPS] : DIGITS);

const isNumberAtom = (a) => /^\d+$/.test(a ?? "");

export class Builder {
  /**
   * @param {number} slots how many slot keys the surface has for the builder.
   *   The module cannot know this, so it is a config field.
   */
  constructor(slots = 12) {
    this.slots = Math.max(1, Number(slots) || 12);
    /** Labels of the saved macros, injected by the module before rendering. */
    this.macroLabels = [];
    this.reset();
  }

  reset() {
    this.stepId = "verb";
    this.tokens = [];
    this.page = 0;
    this.keypad = false;
    this.atoms = [];
    this.history = [];
    this.message = "";
  }

  // --- what the surface shows ----------------------------------------------

  get step() {
    return STEPS[this.stepId] ?? STEPS.verb;
  }

  /** The command as built so far. */
  get line() {
    return this.tokens.join(" ");
  }

  /** The line plus whatever is half-typed on the keypad, for the preview key. */
  get preview() {
    const pending = this.atoms.join(" ");
    return [this.line, pending].filter((s) => s !== "").join(" ");
  }

  get prompt() {
    if (this.keypad) {
      const s = this.step;
      return `${s.what} ${s.min}-${s.max}`;
    }
    return this.step.prompt;
  }

  /** Whether the line as it stands would compile — what lights Fire. */
  get valid() {
    return this.line !== "" && plan(this.line).ok;
  }

  /** Why it would not, for the operator to read. */
  get why() {
    if (this.line === "") return "";
    const p = plan(this.line);
    return p.ok ? "" : p.error;
  }

  /**
   * Every entry the current step offers, before pagination.
   *
   * A number step with a quick list reserves the last slot of every page for
   * the `123…` key, so the keypad is always one press away however long the
   * list is.
   */
  entries() {
    const s = this.step;

    if (s.kind === "number") {
      if (this.keypad || !s.quick) return keypadFor(s);
      return s.quick.map((q) => ({
        label: q.label,
        kind: "choice",
        act: { type: "quick", text: q.text },
      }));
    }

    if (s.kind === "macro") {
      const out = [];
      for (let n = 1; n <= MACRO_SLOTS; n++) {
        const label = this.macroLabels[n - 1] ?? "";
        out.push({
          label: label === "" ? `${n}\n(empty)` : label,
          kind: label === "" ? "empty" : "macro",
          act: { type: "macro", slot: n, empty: label === "" },
        });
      }
      return out;
    }

    return (s.choices ?? []).map((c) => ({
      label: c.label,
      kind: c.kind ?? "choice",
      act: c.act ? { type: c.act } : { type: "choice", choice: c },
    }));
  }

  /** How many slots each page of this step actually holds. */
  perPage() {
    const s = this.step;
    const reserve = s.kind === "number" && !this.keypad && s.quick ? 1 : 0;
    return Math.max(1, this.slots - reserve);
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.entries().length / this.perPage()));
  }

  /**
   * The slot faces, exactly `slots` long.
   *
   * Always full length: a slot with nothing in it must be blanked, or the key
   * keeps the label of whatever the previous step put there and reads as a
   * live choice.
   */
  view() {
    const entries = this.entries();
    const per = this.perPage();
    const pages = this.pageCount();
    const page = ((this.page % pages) + pages) % pages;
    const shown = entries.slice(page * per, page * per + per);

    const out = shown.map((e) => ({ label: e.label, kind: e.kind }));
    while (out.length < per) out.push({ label: "", kind: "empty" });
    if (per < this.slots) out.push({ label: "123…", kind: "operator" }); // the reserved keypad key
    while (out.length < this.slots) out.push({ label: "", kind: "empty" });
    return out;
  }

  // --- pressing ------------------------------------------------------------

  /** Snapshot before a change, so Back is an undo rather than a guess. */
  snapshot() {
    this.history.push({
      stepId: this.stepId,
      tokens: [...this.tokens],
      page: this.page,
      keypad: this.keypad,
      atoms: [...this.atoms],
    });
  }

  /**
   * Press slot `n`, 1-based.
   *
   * Returns an effect for the caller to carry out — `{ fire }`, `{ save }`,
   * `{ saveTo }`, `{ load }` — or undefined. Nothing here talks to a device.
   */
  press(n) {
    const per = this.perPage();
    const pages = this.pageCount();
    const page = ((this.page % pages) + pages) % pages;
    const index = page * per + (n - 1);

    if (n > per) {
      // The reserved slot: switch a quick list to the keypad.
      if (per < this.slots) {
        this.snapshot();
        this.keypad = true;
        this.page = 0;
      }
      return;
    }

    const entry = this.entries()[index];
    if (!entry) return;
    return this.act(entry.act);
  }

  act(a) {
    switch (a.type) {
      case "choice": {
        this.snapshot();
        this.message = "";
        if (a.choice.text) this.tokens.push(...a.choice.text.split(" "));
        this.goto(a.choice.next);
        return;
      }
      case "quick": {
        this.snapshot();
        this.message = "";
        this.tokens.push(a.text);
        this.goto(this.step.next);
        return;
      }
      case "digit": {
        this.snapshot();
        const last = this.atoms[this.atoms.length - 1];
        if (isNumberAtom(last)) this.atoms[this.atoms.length - 1] = last + a.d;
        else this.atoms.push(a.d);
        return;
      }
      case "op": {
        // An operator needs something to operate on, except `Thru`, which may
        // lead: `Thru 8` is "everything up to 8".
        if (this.atoms.length === 0 && a.op !== "Thru") return;
        if (!isNumberAtom(this.atoms[this.atoms.length - 1])) return;
        this.snapshot();
        this.atoms.push(a.op);
        return;
      }
      case "backspace": {
        this.snapshot();
        const last = this.atoms[this.atoms.length - 1];
        if (isNumberAtom(last) && last.length > 1)
          this.atoms[this.atoms.length - 1] = last.slice(0, -1);
        else this.atoms.pop();
        return;
      }
      case "enter": {
        if (!this.canEnter()) return;
        this.snapshot();
        this.tokens.push(...this.atoms);
        this.atoms = [];
        this.keypad = false;
        this.goto(this.step.next);
        return;
      }
      case "macro": {
        const step = this.step;
        if (step.act === "store") return { saveTo: a.slot };
        if (a.empty) return;
        return { load: a.slot };
      }
      case "fire":
        return { fire: true };
      case "save":
        return this.valid ? this.goto("macro_save") : { refuse: this.why };
      case "home":
        this.home();
        return;
      default:
        return;
    }
  }

  /**
   * Whether the keypad expression is finished.
   *
   * A trailing `Thru` is legal — `1 Thru` is open-ended, meaning everything
   * from 1 to the maximum — so it is the one operator that may end an entry.
   */
  canEnter() {
    const last = this.atoms[this.atoms.length - 1];
    if (isNumberAtom(last)) return true;
    return last === "Thru" && this.atoms.length > 1;
  }

  goto(stepId) {
    const next = STEPS[stepId] ? stepId : "end";
    this.stepId = next;
    this.page = 0;
    this.keypad = STEPS[next]?.kind === "number" && !STEPS[next].quick;
    this.atoms = [];
  }

  /** Undo one press. In the keypad, that is one digit. */
  back() {
    const prev = this.history.pop();
    if (!prev) return;
    this.stepId = prev.stepId;
    this.tokens = prev.tokens;
    this.page = prev.page;
    this.keypad = prev.keypad;
    this.atoms = prev.atoms;
    this.message = "";
  }

  home() {
    this.reset();
  }

  /** Next page of a long list, wrapping. */
  more() {
    this.page = (this.page + 1) % this.pageCount();
  }

  /** Drop the operator straight into a step, for loading a saved macro back. */
  loadLine(text) {
    this.reset();
    this.tokens = String(text ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    this.stepId = "end";
  }
}

export { MACRO_SLOTS };
