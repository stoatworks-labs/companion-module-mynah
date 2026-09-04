import { api } from "./api.js";
import { plan, buildCommand, keyTitle } from "./commands.js";
import { MACRO_SLOTS, setMacro, writeMacros, macroLabels } from "./macros.js";

const MODE_CHOICES = [
  { id: "", label: "Default (Recall → Preview, Store → Program)" },
  { id: "Preview", label: "Preview" },
  { id: "Program", label: "Program" },
];

const TARGET_CHOICES = [
  { id: "screen", label: "Screen" },
  { id: "aux", label: "Aux" },
];

/** Send a compiled plan, logging what went and why if it did not. */
function run(self, command) {
  const p = plan(command);
  if (!p.ok) {
    self.log("warn", `Refused "${command}": ${p.error}`);
    self.state.lastError = p.error;
    self.onStateChanged?.();
    return;
  }
  if (!api.connected) {
    self.log("warn", `Not connected; "${command}" not sent`);
    self.state.lastError = "Not connected";
    self.onStateChanged?.();
    return;
  }

  for (const op of p.ops) api.write(op.path, op.value);

  self.state.lastCommand = command;
  self.state.lastSummary = p.summary;
  self.state.lastError = "";
  self.log(
    "debug",
    `${command} → ${p.summary} (${p.ops.length} op${p.ops.length === 1 ? "" : "s"})`,
  );
  self.onStateChanged?.();
}

/**
 * Carry out whatever a builder press asked for.
 *
 * The builder itself is pure — a press returns an effect and touches nothing —
 * so this is the only place where building a command meets the device or the
 * saved config. Every path ends by refreshing, because the slot faces ARE the
 * interface: a press that does not repaint them looks like a dead key.
 */
function effect(self, e) {
  const b = self.builder;

  if (e?.fire) {
    if (!b.valid) {
      b.message = b.why || "Nothing to fire yet";
    } else {
      b.message = "";
      run(self, b.line);
    }
  } else if (e?.refuse) {
    b.message = e.refuse;
  } else if (e?.saveTo) {
    saveMacro(self, e.saveTo, b.line);
    b.message = `Saved to macro ${e.saveTo}`;
    b.home();
  } else if (e?.load) {
    const macro = self.macros?.[e.load - 1];
    if (macro) b.loadLine(macro.line);
  }

  self.onStateChanged?.();
}

/**
 * Persist one macro slot.
 *
 * `saveConfig` is the only durable store a module has, which is also why the
 * macros are worth keeping there rather than in a file beside the module: this
 * way they are part of a Companion configuration export.
 */
function saveMacro(self, slot, line) {
  self.macros = setMacro(self.macros ?? [], slot, line, keyTitle(line));
  self.config = { ...self.config, macros: writeMacros(self.macros) };
  self.builder.macroLabels = macroLabels(self.macros);
  self.saveConfig(self.config);
}

const SLOT_OPTION = {
  type: "number",
  id: "slot",
  label: "Slot",
  default: 1,
  min: 1,
  max: 32,
};

const MACRO_SLOT_OPTION = {
  type: "number",
  id: "slot",
  label: "Macro slot",
  default: 1,
  min: 1,
  max: MACRO_SLOTS,
};

export default function UpdateActions(self) {
  self.setActionDefinitions({
    // The headline. Anything the grammar accepts, on one button.
    command: {
      name: "Command (Mynah syntax)",
      description:
        'Any Mynah command, e.g. "Recall Screen 1 Memory 5" or "Store Master 12 If Screen 1 + 3 Category Source". Supports variables.',
      options: [
        {
          type: "textinput",
          id: "command",
          label: "Command",
          default: "Recall Screen 1 Memory 1",
          useVariables: true,
          tooltip:
            "Verb first. Thru / + / - build ranges. If masks a Store Master.",
        },
      ],
      // The option arrives already resolved. `parseVariablesInString` does not
      // exist on the callback context in base 2.x — Companion expands variables
      // itself before invoking the callback, and calling it throws at press
      // time while the module still loads and every other action works.
      callback: (event) => run(self, event.options.command ?? ""),
    },

    recall_memory: {
      name: "Recall memory",
      options: [
        {
          type: "dropdown",
          id: "target",
          label: "On",
          default: "screen",
          choices: TARGET_CHOICES,
        },
        {
          type: "number",
          id: "screen",
          label: "Screen / Aux number",
          default: 1,
          min: 1,
          max: 96,
        },
        {
          type: "number",
          id: "memory",
          label: "Memory",
          default: 1,
          min: 1,
          max: 1000,
        },
        {
          type: "dropdown",
          id: "mode",
          label: "Into",
          default: "",
          choices: MODE_CHOICES,
        },
      ],
      callback: (event) => run(self, buildCommand("Recall", event.options)),
    },

    recall_master: {
      name: "Recall master memory",
      options: [
        {
          type: "number",
          id: "memory",
          label: "Master memory",
          default: 1,
          min: 1,
          max: 500,
        },
        {
          type: "dropdown",
          id: "mode",
          label: "Into",
          default: "",
          choices: MODE_CHOICES,
        },
      ],
      callback: (event) =>
        run(
          self,
          buildCommand("Recall", { ...event.options, target: "master" }),
        ),
    },

    recall_layer_memory: {
      name: "Recall layer memory",
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
          id: "layer",
          label: "Layer",
          default: 1,
          min: 1,
          max: 128,
        },
        {
          type: "number",
          id: "memory",
          label: "Layer memory",
          default: 1,
          min: 1,
          max: 50,
        },
        {
          type: "dropdown",
          id: "mode",
          label: "Into",
          default: "",
          choices: MODE_CHOICES,
        },
      ],
      callback: (event) => run(self, buildCommand("Recall", event.options)),
    },

    store_memory: {
      name: "Store memory",
      description:
        "Overwrites the memory. Defaults to storing from Program, as the device does.",
      options: [
        {
          type: "dropdown",
          id: "target",
          label: "From",
          default: "screen",
          choices: TARGET_CHOICES,
        },
        {
          type: "number",
          id: "screen",
          label: "Screen / Aux number",
          default: 1,
          min: 1,
          max: 96,
        },
        {
          type: "number",
          id: "memory",
          label: "Memory",
          default: 1,
          min: 1,
          max: 1000,
        },
        {
          type: "dropdown",
          id: "mode",
          label: "From",
          default: "",
          choices: MODE_CHOICES,
        },
      ],
      callback: (event) => run(self, buildCommand("Store", event.options)),
    },

    take: {
      name: "Take",
      options: [
        {
          type: "dropdown",
          id: "target",
          label: "On",
          default: "screen",
          choices: TARGET_CHOICES,
        },
        {
          type: "number",
          id: "screen",
          label: "Screen / Aux number",
          default: 1,
          min: 1,
          max: 96,
        },
      ],
      callback: (event) => run(self, buildCommand("Take", event.options)),
    },

    // --- the command builder ------------------------------------------------

    builder_slot: {
      name: "Builder: press slot",
      description:
        "One key of the builder's slot grid. What it does depends on what the builder is showing — put the matching variable on the key's text so it says so.",
      options: [SLOT_OPTION],
      callback: (event) =>
        effect(self, self.builder.press(Number(event.options.slot) || 1)),
    },

    builder_back: {
      name: "Builder: back",
      description:
        "Undo one press. On the keypad that is one digit; otherwise it is one step of the command.",
      options: [],
      callback: () => {
        self.builder.back();
        self.builder.message = "";
        self.onStateChanged?.();
      },
    },

    builder_home: {
      name: "Builder: start over",
      options: [],
      callback: () => {
        self.builder.home();
        self.onStateChanged?.();
      },
    },

    builder_more: {
      name: "Builder: next page of choices",
      description:
        "Long lists — screens, categories, macros — page across the slots. Wraps at the end.",
      options: [],
      callback: () => {
        self.builder.more();
        self.onStateChanged?.();
      },
    },

    builder_fire: {
      name: "Builder: fire the command",
      description:
        "Sends whatever is built. Live from the moment the line compiles, which is usually before the last question is answered — the grammar takes its clauses in any order.",
      options: [],
      callback: () => effect(self, { fire: true }),
    },

    builder_save: {
      name: "Builder: save as macro",
      description: "Asks which macro slot, then parks the line there.",
      options: [],
      callback: () => effect(self, self.builder.act({ type: "save" })),
    },

    // --- macros -------------------------------------------------------------

    macro_run: {
      name: "Macro: fire",
      options: [MACRO_SLOT_OPTION],
      callback: (event) => {
        const macro = self.macros?.[(Number(event.options.slot) || 1) - 1];
        if (!macro) {
          self.log("warn", `Macro slot ${event.options.slot} is empty`);
          return;
        }
        run(self, macro.line);
      },
    },

    macro_edit: {
      name: "Macro: load into the builder",
      description:
        "Puts a saved macro back on the builder's line, to fire, or to save somewhere else.",
      options: [MACRO_SLOT_OPTION],
      callback: (event) =>
        effect(self, { load: Number(event.options.slot) || 1 }),
    },

    macro_store_current: {
      name: "Macro: save the builder's line to a slot",
      description:
        "Skips the slot-picking step, for a key that always saves to the same place.",
      options: [MACRO_SLOT_OPTION],
      callback: (event) =>
        effect(self, { saveTo: Number(event.options.slot) || 1 }),
    },

    macro_delete: {
      name: "Macro: clear a slot",
      options: [MACRO_SLOT_OPTION],
      callback: (event) => {
        saveMacro(self, Number(event.options.slot) || 1, "");
        self.onStateChanged?.();
      },
    },
  });
}
