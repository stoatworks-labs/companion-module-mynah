/**
 * Variables.
 *
 * Definitions are an OBJECT keyed by variable id — `setVariableDefinitions`
 * literally throws on an array, which fails init() and leaves a dead
 * connection with no actions and no visible cause.
 */

/** Screens given their own per-screen variables. Twenty-four would be noise. */
const TRACKED_SCREENS = 8;

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
  self.setVariableValues(values);
}
