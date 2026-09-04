import { combineRgb } from "@companion-module/base";

import { MACRO_SLOTS } from "./macros.js";

/**
 * What kind of thing a builder slot is showing.
 *
 * A boolean feedback can only be on or off, so a slot key carries one entry
 * per kind and each paints its own colour. That is how a key that is a digit
 * one moment and a Delete the next can look like both.
 */
const SLOT_KINDS = [
  { id: "choice", label: "A word of the command" },
  { id: "digit", label: "A keypad digit" },
  { id: "operator", label: "Thru, +, -, backspace or the keypad key" },
  { id: "action", label: "Fire, enter or another action" },
  { id: "danger", label: "Something that overwrites or deletes" },
  { id: "macro", label: "A saved macro" },
  { id: "empty", label: "Nothing — the slot is blank" },
];

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

    // --- the command builder ------------------------------------------------

    builder_slot_kind: {
      name: "Builder: what a slot is showing",
      description:
        "Lit when the slot currently holds this kind of thing. The slot presets ship with one of these per kind, so an empty slot goes dark and a Delete goes red without the operator configuring anything.",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(40, 50, 65),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "slot",
          label: "Slot",
          default: 1,
          min: 1,
          max: 32,
        },
        {
          type: "dropdown",
          id: "kind",
          label: "Showing",
          default: "empty",
          choices: SLOT_KINDS.map((k) => ({ id: k.id, label: k.label })),
        },
      ],
      callback: (feedback) => {
        const slot = Number(feedback.options.slot) || 1;
        const view = self.builder.view();
        return (view[slot - 1]?.kind ?? "empty") === feedback.options.kind;
      },
    },

    builder_ready: {
      name: "Builder: the line would fire",
      description:
        "Lit whenever what has been built so far compiles. That is usually before the builder has finished asking — the grammar takes its clauses in any order, so Take Screen 1 is complete the moment the screen is chosen.",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(45, 140, 75),
        color: combineRgb(255, 255, 255),
      },
      options: [],
      callback: () => self.builder.valid,
    },

    builder_has_more: {
      name: "Builder: the list has more pages",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(180, 130, 40),
        color: combineRgb(0, 0, 0),
      },
      options: [],
      callback: () => self.builder.pageCount() > 1,
    },

    macro_present: {
      name: "Macro: the slot holds a command",
      type: "boolean",
      defaultStyle: {
        bgcolor: combineRgb(90, 60, 130),
        color: combineRgb(255, 255, 255),
      },
      options: [
        {
          type: "number",
          id: "slot",
          label: "Macro slot",
          default: 1,
          min: 1,
          max: MACRO_SLOTS,
        },
      ],
      callback: (feedback) =>
        Boolean(self.macros?.[(Number(feedback.options.slot) || 1) - 1]),
    },
  });
}
