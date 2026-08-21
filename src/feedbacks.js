import { combineRgb } from "@companion-module/base";

/**
 * Feedbacks.
 *
 * What can honestly be shown is narrower than it looks. The device reports
 * which memory sits in a buffer keyed A/B/C, and preview/program are names for
 * whichever buffer is currently pending or live — a mapping that was observed
 * differing *between screens on the same device* (S1 on A while S2–S4 were on
 * B). Resolving a buffer to preview or program needs take state this module
 * does not track, so there is no "in program" feedback here. There is a
 * truthful "this memory is loaded on this screen", and that is all.
 */
export default function UpdateFeedbacks(self) {
  self.setFeedbackDefinitions({
    memory_loaded: {
      name: "Memory is loaded on a screen",
      description:
        "Lit when the named memory currently sits in one of the screen's preset buffers. Does not distinguish preview from program — the device does not report that directly.",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(0, 90, 40),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "screen",
          label: "Screen",
          default: 1,
          min: 1,
          max: 24,
        },
        {
          type: "number",
          id: "memory",
          label: "Memory",
          default: 1,
          min: 1,
          max: 1000,
        },
      ],
      callback: (feedback) => {
        const buffers = self.state.presetId[`S${feedback.options.screen}`];
        if (!buffers) return false;
        return Object.values(buffers).includes(Number(feedback.options.memory));
      },
    },

    connected: {
      name: "Connected to the device",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(0, 0, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [],
      callback: () => self.state.connected === true,
    },

    vendor_selected: {
      name: "Screen is selected in the vendor Web RCS",
      description:
        "Lit when this screen is part of the selection in Analog Way's own Web RCS, which rides the same socket.",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(90, 70, 0),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "screen",
          label: "Screen",
          default: 1,
          min: 1,
          max: 24,
        },
      ],
      callback: (feedback) =>
        (self.state.vendorSelection ?? []).includes(
          `S${feedback.options.screen}`,
        ),
    },
  });
}
