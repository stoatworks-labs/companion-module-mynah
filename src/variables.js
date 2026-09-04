/**
 * Variables.
 *
 * Definitions are an OBJECT keyed by variable id — `setVariableDefinitions`
 * literally throws on an array, which fails init() and leaves a dead
 * connection with no actions and no visible cause.
 */

import { MACRO_SLOTS } from "./menu.js";

/** Screens given their own per-screen variables. Twenty-four would be noise. */
const TRACKED_SCREENS = 8;

/**
 * Slot faces are defined for every slot a surface could have, not for the
 * configured count.
 *
 * A variable that is defined but never set renders as raw `$(...)` on the key,
 * and lowering the slot count would do exactly that to the slots above it. So
 * all 32 exist always and the ones past the count are set to an empty string.
 */
const MAX_SLOTS = 32;

export default function UpdateVariableDefinitions(self) {
  const defs = {
    connected: { name: "Connected to the device" },
    model: { name: "Device model" },
    device_label: { name: "Device label" },
    last_command: { name: "Last command sent" },
    last_summary: { name: "What the last command did" },
    last_error: { name: "Last refusal or error" },
    vendor_selection: { name: "Screens selected in the vendor Web RCS" },
  };

  for (let n = 1; n <= TRACKED_SCREENS; n++) {
    defs[`screen_${n}_memory`] = { name: `Screen ${n} — memory loaded` };
  }

  defs.builder_line = { name: "Builder — the command so far" };
  defs.builder_prompt = { name: "Builder — what it is asking for" };
  defs.builder_valid = { name: "Builder — would the line fire (yes/no)" };
  defs.builder_error = { name: "Builder — why the line will not fire" };
  defs.builder_page = { name: "Builder — page of the current list" };

  for (let n = 1; n <= MAX_SLOTS; n++) {
    defs[`b${n}`] = { name: `Builder slot ${n} — key face` };
  }
  for (let n = 1; n <= MACRO_SLOTS; n++) {
    defs[`macro_${n}_label`] = { name: `Macro ${n} — key face` };
    defs[`macro_${n}_line`] = { name: `Macro ${n} — command` };
  }

  self.setVariableDefinitions(defs);
}

/**
 * A screen's loaded memory, across whichever buffers hold one.
 *
 * The device reports memories against buffers A/B/C, and preview/program are
 * names for whichever buffer is pending or live — a mapping that differs
 * between screens on the same device. So this reports the memories present
 * without claiming which is on air, because that cannot be known from this
 * alone and a confident wrong answer is worse than an honest vague one.
 */
function memoryFor(state, n) {
  const buffers = state.presetId[`S${n}`];
  if (!buffers) return "";
  const ids = [...new Set(Object.values(buffers).filter((v) => v > 0))].sort(
    (a, b) => a - b,
  );
  return ids.join("/");
}

export function refreshVariables(self) {
  const s = self.state;
  const values = {
    connected: s.connected ? "yes" : "no",
    model: s.model ?? "",
    device_label: s.label ?? "",
    last_command: s.lastCommand ?? "",
    last_summary: s.lastSummary ?? "",
    last_error: s.lastError ?? "",
    vendor_selection: (s.vendorSelection ?? []).join(", "),
  };
  for (let n = 1; n <= TRACKED_SCREENS; n++) {
    values[`screen_${n}_memory`] = memoryFor(s, n);
  }

  const b = self.builder;
  const view = b.view();
  values.builder_line = b.preview;
  values.builder_prompt = b.prompt;
  values.builder_valid = b.valid ? "yes" : "no";
  values.builder_error = b.message || b.why;
  values.builder_page =
    b.pageCount() > 1 ? `${(b.page % b.pageCount()) + 1}/${b.pageCount()}` : "";

  for (let n = 1; n <= MAX_SLOTS; n++) {
    values[`b${n}`] = view[n - 1]?.label ?? "";
  }
  for (let n = 1; n <= MACRO_SLOTS; n++) {
    const m = self.macros?.[n - 1];
    values[`macro_${n}_label`] = m?.label ?? "";
    values[`macro_${n}_line`] = m?.line ?? "";
  }

  self.setVariableValues(values);
}
