/**
 * The builder's step graph.
 *
 * Data only — no Companion imports, no state. `builder.js` walks this.
 *
 * These steps are WRITTEN DOWN, not derived from the grammar, and that is a
 * deliberate choice with a cost. `completions()` in the language bundle is a
 * prefix filter over the keyword list — it answers "what could this half-typed
 * word become", not "what is legal here" — and the parser is a flat, order-free
 * clause loop with no tree to walk out of. So the alternative to this file is
 * teaching the mynah parser to report an expected-token set, which is a change
 * in another repo for the sake of four verbs.
 *
 * The guard against this file drifting from the grammar is in the test suite:
 * every path this graph can emit is walked and handed to `plan()`. The menu can
 * be wrong about taste; it cannot be wrong about legality without turning the
 * suite red.
 */

import { DIMS, SLOTS } from "./lang.js";

/**
 * The record-mask categories, in the keyword spelling the grammar wants.
 *
 * Written out rather than derived from `CATEGORIES`, which carries the
 * *device's* spelling (`POS`, `FLYING_CURVE`), and rather than filtered out of
 * `KEYWORDS`, where four of them moved from `category` to `attribute` when
 * `Set` arrived. The path walk proves each one still parses after `If Category`.
 */
const CATEGORY_WORDS = [
  ["Source", "Source"],
  ["Position", "Pos"],
  ["Size", "Size"],
  ["Opacity", "Opacity"],
  ["Cropping", "Crop"],
  ["Border", "Border"],
  ["Transitions", "Trans"],
  ["Effects", "FX"],
  ["FlyingCurve", "Flying\nCurve"],
  ["Timing", "Timing"],
  ["Speed", "Speed"],
  ["CutAndFill", "Cut &\nFill"],
  ["Mask", "Mask"],
  ["Keyer", "Keyer"],
];

/** How many macro slots the surface can save into. */
export const MACRO_SLOTS = 24;

/**
 * A quick-pick list of numbers.
 *
 * Enumerating an operand is only ever an option, never the whole story: aux
 * runs to 96, layers to 128 and memories to 1000, so every number step keeps a
 * keypad behind a `123…` key. The cap here is about how far it is worth
 * paging before typing is quicker, not about the device's real limit.
 */
const upTo = (n, from = 1) =>
  Array.from({ length: n - from + 1 }, (_, i) => ({
    label: String(from + i),
    text: String(from + i),
  }));

/**
 * A numeric operand.
 *
 * `range` says whether `Thru + -` belong on the keypad. Only a *target* takes
 * a range — screens, auxes, layers, multiviewer outputs. A memory slot is one
 * number: `Recall Screen 1 Thru 4 Memory 2` is four recalls of one memory,
 * while `Memory 1 Thru 3` does not parse at all. The keypad hides the
 * operators rather than offering keys that build a command the grammar
 * refuses.
 */
const number = (prompt, what, min, max, next, quick, range = false) => ({
  kind: "number",
  prompt,
  what,
  min,
  max,
  next,
  quick,
  range,
});

const choice = (prompt, choices) => ({ kind: "choice", prompt, choices });

/**
 * The steps for one verb.
 *
 * Recall, Store and Delete share a shape; Take is only ever a screen or an aux,
 * and Delete and Take take no preset mode. Generating them rather than writing
 * four near-copies means a fix lands in all of them.
 */
function verbSteps(verb, opts) {
  const v = verb.toLowerCase();
  const id = (suffix) => `${v}_${suffix}`;
  const steps = {};

  // Where a finished clause goes: to the mode question if this verb has one,
  // otherwise straight to the end.
  const afterValue = opts.mode ? id("mode") : "end";

  const objects = [
    {
      label: "Screen",
      text: "Screen",
      next: id("screen_n"),
    },
    { label: "Aux", text: "Aux", next: id("aux_n") },
  ];
  if (!opts.takeOnly) {
    objects.push(
      { label: "Master", text: "Master", next: id("master_n") },
      { label: "Multi-\nviewer", text: "Multiviewer", next: id("mv_n") },
    );
  }

  steps[id("obj")] = choice(`${verb} what?`, objects);

  // --- screen and aux ------------------------------------------------------

  const targetNext = opts.takeOnly ? "end" : id("target_after");

  steps[id("screen_n")] = number(
    "Which screen?",
    "Screen",
    DIMS.screen.min,
    DIMS.screen.max,
    targetNext,
    upTo(DIMS.screen.max),
    true,
  );
  steps[id("aux_n")] = number(
    "Which aux?",
    "Aux",
    DIMS.aux.min,
    DIMS.aux.max,
    targetNext,
    upTo(16),
    true,
  );

  if (!opts.takeOnly) {
    steps[id("target_after")] = choice("On that screen…", [
      { label: "Memory", text: "Memory", next: id("mem_n") },
      { label: "Layer", text: "Layer", next: id("layer_n") },
    ]);

    steps[id("mem_n")] = number(
      "Which memory?",
      "Memory",
      SLOTS.screen.min,
      SLOTS.screen.max,
      afterValue,
      upTo(24),
    );

    // `Native` is a layer too, and sits outside the numeric range — so it
    // belongs on the quick list rather than in the keypad, which only makes
    // numbers.
    steps[id("layer_n")] = number(
      "Which layer?",
      "Layer",
      DIMS.layer.min,
      DIMS.layer.max,
      id("layer_after"),
      [{ label: "Native", text: "Native" }, ...upTo(16)],
      true,
    );
    steps[id("layer_after")] = choice("On that layer…", [
      { label: "Memory", text: "Memory", next: id("layermem_n") },
    ]);
    steps[id("layermem_n")] = number(
      "Which layer memory?",
      "Memory",
      SLOTS.layer.min,
      SLOTS.layer.max,
      afterValue,
      upTo(24),
    );

    // --- master ------------------------------------------------------------

    steps[id("master_n")] = number(
      "Which master memory?",
      "Master",
      SLOTS.master.min,
      SLOTS.master.max,
      opts.filter ? id("master_after") : afterValue,
      upTo(24),
    );

    if (opts.filter) {
      steps[id("master_after")] = choice("Master memory…", [
        { label: "Mask\nit (If)", text: "If", next: id("filter") },
        { label: "From\nPreview", text: "Preview", next: "end" },
        { label: "From\nProgram", text: "Program", next: "end" },
        { label: "Done", text: "", next: "end" },
      ]);
    }

    // --- multiviewer -------------------------------------------------------

    steps[id("mv_n")] = number(
      "Which multiviewer output?",
      "Multiviewer",
      DIMS.multiviewer.min,
      DIMS.multiviewer.max,
      id("mv_after"),
      upTo(DIMS.multiviewer.max),
      true,
    );
    steps[id("mv_after")] = choice("On that output…", [
      { label: "Memory", text: "Memory", next: id("mvmem_n") },
    ]);
    // A multiviewer memory has no preview or program — the device does not
    // hold one pending — so this one ends rather than asking.
    steps[id("mvmem_n")] = number(
      "Which multiviewer memory?",
      "Memory",
      SLOTS.multiviewer.min,
      SLOTS.multiviewer.max,
      "end",
      upTo(24),
    );
  }

  // --- preset mode ---------------------------------------------------------

  if (opts.mode) {
    steps[id("mode")] = choice(
      verb === "Store" ? "Take the values from…" : "Load into…",
      [
        { label: "Preview", text: "Preview", next: "end" },
        { label: "Program", text: "Program", next: "end" },
        { label: "Default\n(done)", text: "", next: "end" },
      ],
    );
  }

  return steps;
}

/**
 * The `If` filter on a master store.
 *
 * A loop, because `parseFilter` is one: Screen, Aux, Layer and Category may
 * appear in any order and each may appear once. This is the flagship reason to
 * have a builder at all — a masked master store is the most tedious command in
 * the grammar to type and the one most worth having on a key.
 */
function filterSteps() {
  const steps = {};

  // `If` with nothing after it does not parse — the grammar wants at least one
  // filter — so the first pass through the loop has no way out but a filter.
  // Same two-step shape as the categories, and for the same reason: what a
  // press emits stays a property of the step rather than of hidden state.
  const clauses = [
    { label: "Screen", text: "Screen", next: "store_filter_screen_n" },
    { label: "Aux", text: "Aux", next: "store_filter_aux_n" },
    { label: "Layer", text: "Layer", next: "store_filter_layer_n" },
    { label: "Category", text: "Category", next: "store_cat_first" },
  ];
  steps.store_filter = choice("Mask the store to…", clauses);
  steps.store_filter_more = choice("And also…", [
    ...clauses,
    { label: "Done", text: "", next: "store_filter_mode" },
  ]);

  steps.store_filter_screen_n = number(
    "Mask to which screens?",
    "Screen",
    DIMS.screen.min,
    DIMS.screen.max,
    "store_filter_more",
    upTo(DIMS.screen.max),
    true,
  );
  steps.store_filter_aux_n = number(
    "Mask to which auxes?",
    "Aux",
    DIMS.aux.min,
    DIMS.aux.max,
    "store_filter_more",
    upTo(16),
    true,
  );
  steps.store_filter_layer_n = number(
    "Mask to which layers?",
    "Layer",
    DIMS.layer.min,
    DIMS.layer.max,
    "store_filter_more",
    [{ label: "Native", text: "Native" }, ...upTo(16)],
    true,
  );

  // The first category follows the `Category` keyword; every one after it is
  // joined with a `+`. Two steps rather than one piece of state, so the text a
  // press emits stays a property of the step.
  steps.store_cat_first = choice(
    "Record which categories?",
    CATEGORY_WORDS.map(([word, label]) => ({
      label,
      text: word,
      next: "store_cat_more",
    })),
  );
  steps.store_cat_more = choice("And also…", [
    ...CATEGORY_WORDS.map(([word, label]) => ({
      label: `+ ${label}`,
      text: `+ ${word}`,
      next: "store_cat_more",
    })),
    { label: "Done", text: "", next: "store_filter_more" },
  ]);

  steps.store_filter_mode = choice("Take the values from…", [
    { label: "Preview", text: "Preview", next: "end" },
    { label: "Program", text: "Program", next: "end" },
    { label: "Default\n(done)", text: "", next: "end" },
  ]);

  return steps;
}

/**
 * The whole graph.
 *
 * `Label` is absent because it needs a quoted string and there is no text entry
 * on a control surface. `Set` is absent because `compile()` refuses it without
 * live buffer state this module does not track — see docs/BUILDER.md. `Select`
 * and `Clear` are absent because `plan()` refuses them, and the builder does
 * not get an exemption from the no-sticky-scope rule.
 */
export const STEPS = {
  verb: choice("Build a command", [
    { label: "Recall", text: "Recall", next: "recall_obj" },
    { label: "Store", text: "Store", next: "store_obj", kind: "danger" },
    { label: "Take", text: "Take", next: "take_obj" },
    { label: "Delete", text: "Delete", next: "delete_obj", kind: "danger" },
    { label: "Macros", text: "", next: "macro_run", kind: "action" },
  ]),

  ...verbSteps("Recall", { mode: true }),
  ...verbSteps("Store", { mode: true, filter: true }),
  ...verbSteps("Take", { takeOnly: true }),
  ...verbSteps("Delete", {}),
  ...filterSteps(),

  // Fire and Save are fixed keys as well, but repeating them here means a
  // surface with nothing but slots is still usable.
  end: {
    kind: "choice",
    prompt: "Ready",
    choices: [
      { label: "FIRE", act: "fire", kind: "action" },
      { label: "Save as\nmacro", act: "save", kind: "action" },
      { label: "Start\nover", act: "home", kind: "action" },
    ],
  },

  /** Pick a macro slot to save the current line into. */
  macro_save: { kind: "macro", prompt: "Save into which slot?", act: "store" },
  /** Pick a macro slot to load back into the builder. */
  macro_run: { kind: "macro", prompt: "Which macro?", act: "load" },
};

export { CATEGORY_WORDS };
