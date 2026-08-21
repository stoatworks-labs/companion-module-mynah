import { api } from "./api.js";
import { plan, buildCommand } from "./commands.js";

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
      callback: async (event, context) => {
        const command = await context.parseVariablesInString(
          event.options.command ?? "",
        );
        run(self, command);
      },
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
  });
}
