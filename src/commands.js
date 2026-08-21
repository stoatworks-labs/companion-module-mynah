/**
 * Turning a command string into device writes.
 *
 * Pure — imports nothing from Companion — so the whole of this file is
 * testable with `node test/smoke.mjs` and no dependencies. Everything the
 * module does to the switcher goes through `plan()`.
 */

import { parse, compile } from "./lang.js";

/**
 * Compile a Mynah command.
 *
 * Returns `{ ok, ops, summary }` or `{ ok: false, error }`. Ops carry paths in
 * the Web RCS store spelling, which is what the socket wants.
 *
 * There is no sticky scope here, deliberately. A control-surface button is not
 * where the operator is looking, and a key whose meaning depends on invisible
 * state is a key that eventually fires at the wrong screen. Every button
 * command must name its own scope, and one that does not is refused at
 * configuration time rather than at showtime.
 */
export function plan(command) {
  const text = String(command ?? "").trim();
  if (text === "") return { ok: false, error: "Empty command" };

  const parsed = parse(text);
  if (!parsed.ok) return { ok: false, error: parsed.errors[0].message };

  const compiled = compile(parsed.command);
  if (!compiled.ok) return { ok: false, error: compiled.errors[0].message };

  if (compiled.ops.length === 0) {
    // Select and Clear are command-line state, and this module has no command
    // line. Saying so is better than a button that silently does nothing.
    return {
      ok: false,
      error: `"${parsed.command.fn}" sets command-line state, which a button has none of — name the scope in the command instead`,
    };
  }

  return {
    ok: true,
    summary: compiled.summary,
    bank: compiled.bank,
    slot: compiled.slot,
    fn: parsed.command.fn,
    ops: compiled.ops.map((op) => ({
      path: op.path.toWs(),
      value: op.value,
      describe: op.describe,
    })),
  };
}

/** Build a command string from the discrete action options. */
export function buildCommand(verb, opts = {}) {
  const bits = [verb];

  if (opts.target === "master") {
    bits.push("Master", String(opts.memory));
    if (opts.mode) bits.push(opts.mode);
    return bits.join(" ");
  }

  if (opts.screen !== undefined && opts.screen !== "") {
    bits.push(opts.target === "aux" ? "Aux" : "Screen", String(opts.screen));
  }
  if (opts.layer !== undefined && opts.layer !== "" && opts.layer !== null) {
    bits.push("Layer", String(opts.layer));
  }
  if (opts.memory !== undefined && opts.memory !== "") {
    bits.push("Memory", String(opts.memory));
  }
  if (opts.mode) bits.push(opts.mode);

  return bits.join(" ");
}

/**
 * A short label for a button face.
 *
 * Long enough to tell two buttons apart, short enough to stay legible on a
 * 72-pixel key: the verb and the numbers are what distinguish one recall from
 * another.
 */
export function keyTitle(command) {
  const text = String(command ?? "").trim();
  if (text === "") return "";

  const parsed = parse(text);
  if (!parsed.ok) return "⚠︎";

  const c = parsed.command;
  const bits = [c.fn];
  if (c.scope.master) bits.push("Mast");
  if (c.scope.screens?.values.length)
    bits.push(`S${c.scope.screens.values.join(".")}`);
  if (c.scope.auxes?.values.length)
    bits.push(`A${c.scope.auxes.values.join(".")}`);
  if (c.scope.layers?.numbers.values.length)
    bits.push(`L${c.scope.layers.numbers.values.join(".")}`);
  if (c.memory !== undefined) bits.push(`M${c.memory}`);
  return bits.join("\\n");
}
