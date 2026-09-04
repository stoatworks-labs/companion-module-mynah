/**
 * Saved macros.
 *
 * A macro is a Mynah command line parked on a numbered slot. They live as JSON
 * in a config field and are written with `saveConfig()`, which means they
 * survive a restart and travel with a Companion configuration export.
 *
 * There is no hidden config field type in base 2.x, so the JSON box is visible
 * in the connection dialog. That is a fair trade rather than a workaround: a
 * macro set becomes something an operator can read, hand-edit and send to
 * someone else.
 *
 * Recall is by slot number with the label on the face as a variable, not by a
 * dropdown of macros — a dropdown's choices are baked into the action
 * definition, so every save would have to re-emit `setActionDefinitions()`,
 * while a numbered slot labels itself and needs nothing re-registered.
 *
 * Pure: no Companion imports.
 */

import { MACRO_SLOTS } from "./menu.js";
import { keyTitle } from "./commands.js";

export { MACRO_SLOTS };

/**
 * Read the slots out of a config value.
 *
 * Always returns exactly `MACRO_SLOTS` entries so callers never index past the
 * end, and never throws: a config field a human can edit is a config field a
 * human can break, and a malformed one should cost the macros, not the
 * connection.
 */
export function readMacros(raw) {
  const empty = Array.from({ length: MACRO_SLOTS }, () => null);
  if (typeof raw !== "string" || raw.trim() === "") return empty;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!Array.isArray(parsed)) return empty;

  return empty.map((_, i) => {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") return null;
    const line = String(entry.line ?? "").trim();
    if (line === "") return null;
    const label = String(entry.label ?? "").trim();
    return { line, label: label === "" ? keyTitle(line) : label };
  });
}

/** Render the slots back to the config value. */
export function writeMacros(macros) {
  const trimmed = [...macros];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === null)
    trimmed.pop();
  return JSON.stringify(
    trimmed.map((m) => (m ? { line: m.line, label: m.label } : null)),
  );
}

/** Put a line on a slot, 1-based, returning a new list. */
export function setMacro(macros, slot, line, label) {
  const out = [...macros];
  if (slot < 1 || slot > MACRO_SLOTS) return out;
  const text = String(line ?? "").trim();
  out[slot - 1] =
    text === "" ? null : { line: text, label: label ?? keyTitle(text) };
  return out;
}

/** The faces, in slot order, for the builder's macro steps and the variables. */
export function macroLabels(macros) {
  return macros.map((m) => m?.label ?? "");
}
