/**
 * Smoke tests. `node test/smoke.mjs`, no test runner, no network.
 *
 * Two things are checked. First the command planner, which is the whole of
 * what this module does to a switcher — every action funnels through `plan()`,
 * so golden paths here are the guard against the vendored language bundle
 * drifting from the source it was built from. Second the module surface loaded
 * against the real `@companion-module/base`, because the traps that have bitten
 * this fleet before — a bare `checkFeedbacks()`, array variable definitions,
 * 1.x preset shapes, a hardcoded variable prefix — all fail silently at
 * runtime and are invisible to a protocol-only test.
 */

import assert from "node:assert/strict";

import { plan, buildCommand, keyTitle } from "../src/commands.js";

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

const awj = (command) => {
  const p = plan(command);
  assert.ok(p.ok, `expected "${command}" to compile: ${p.error ?? ""}`);
  return p;
};

// ---------------------------------------------------------------------------
// The planner — golden device paths
// ---------------------------------------------------------------------------

check("screen memory recall builds the verified path", () => {
  const p = awj("Recall Screen 1 Memory 5");
  assert.equal(p.ops.length, 1);
  assert.deepEqual(p.ops[0].path, [
    "device",
    "presetBank",
    "control",
    "load",
    "slotList",
    "items",
    "5",
    "screenList",
    "items",
    "S1",
    "presetList",
    "items",
    "PREVIEW",
    "pp",
    "xRequest",
  ]);
  assert.equal(p.ops[0].value, true);
});

check("an unqualified recall goes to preview, never to air", () => {
  assert.ok(awj("Recall Screen 1 Memory 5").ops[0].path.includes("PREVIEW"));
});

check("an unqualified store takes from program", () => {
  assert.ok(awj("Store Screen 1 Memory 5").ops[0].path.includes("PROGRAM"));
});

check("a save is addressed target-first, a load slot-first", () => {
  const save = awj("Store Screen 1 Memory 5").ops[0].path.join("/");
  assert.ok(
    save.indexOf("screenList") < save.indexOf("slotList"),
    "save should be target-first",
  );
  const load = awj("Recall Screen 1 Memory 5").ops[0].path.join("/");
  assert.ok(
    load.indexOf("slotList") < load.indexOf("screenList"),
    "load should be slot-first",
  );
});

check("a range expands to one op per screen, in order", () => {
  const p = awj("Recall Screen 1 Thru 4 Memory 7");
  assert.equal(p.ops.length, 4);
  const screens = p.ops.map((o) => o.path[o.path.indexOf("screenList") + 2]);
  assert.deepEqual(screens, ["S1", "S2", "S3", "S4"]);
});

check("a masked master store writes every filter before the trigger", () => {
  const p = awj("Store Master 12 If Screen 1 + 3 Category Source + Position");
  const props = p.ops.map((o) => o.path[o.path.length - 1]);
  assert.deepEqual(props, [
    "mode",
    "screenFilter",
    "auxFilter",
    "layerFilter",
    "categoryFilter",
    "xRequest",
  ]);
  assert.deepEqual(p.ops[1].value, ["S1", "S3"]);
  assert.deepEqual(p.ops[4].value, ["SOURCE", "POS"]);
});

check("an unfiltered master store writes the mask wide open", () => {
  const p = awj("Store Master 12");
  assert.equal(
    p.ops[1].value.length,
    24,
    "screenFilter should list every screen",
  );
});

check("layer memory reaches the layer bank", () => {
  assert.ok(
    awj("Store Screen 3 Layer 1 Memory 7").ops[0].path.includes("layerBank"),
  );
});

check("take builds the screenAuxGroup path", () => {
  assert.deepEqual(awj("Take Screen 2").ops[0].path, [
    "device",
    "screenAuxGroupList",
    "items",
    "S2",
    "control",
    "pp",
    "xTake",
  ]);
});

check("abbreviations resolve exactly as the full words do", () => {
  assert.deepEqual(
    awj("R Sc 1 Th 4 Me 7 Pro").ops,
    awj("Recall Screen 1 Thru 4 Memory 7 Program").ops,
  );
});

// ---------------------------------------------------------------------------
// The planner — refusals
// ---------------------------------------------------------------------------

check("an out-of-range screen is refused, not clamped", () => {
  const p = plan("Recall Screen 99 Memory 1");
  assert.equal(p.ok, false);
  assert.match(p.error, /out of range/);
});

check("layer memories are capped at 50", () => {
  assert.match(plan("Recall Screen 1 Layer 1 Memory 51").error, /1 to 50/);
});

check("Select is refused, because a button has no command line", () => {
  const p = plan("Select Screen 1");
  assert.equal(p.ok, false);
  assert.match(p.error, /command-line state/);
});

check("a command with no scope is refused rather than guessing", () => {
  assert.equal(plan("Recall Memory 5").ok, false);
});

check("an empty command is refused", () => {
  assert.equal(plan("").ok, false);
});

// ---------------------------------------------------------------------------
// Option-built commands and button titles
// ---------------------------------------------------------------------------

check("buildCommand assembles from action options", () => {
  assert.equal(
    buildCommand("Recall", { target: "screen", screen: 2, memory: 9 }),
    "Recall Screen 2 Memory 9",
  );
  assert.equal(
    buildCommand("Recall", { target: "master", memory: 4 }),
    "Recall Master 4",
  );
  assert.equal(
    buildCommand("Take", { target: "aux", screen: 3 }),
    "Take Aux 3",
  );
});

check("everything buildCommand produces actually compiles", () => {
  for (const c of [
    buildCommand("Recall", { target: "screen", screen: 1, memory: 1 }),
    buildCommand("Recall", { target: "master", memory: 1, mode: "Program" }),
    buildCommand("Recall", {
      target: "screen",
      screen: 1,
      layer: 2,
      memory: 3,
    }),
    buildCommand("Store", { target: "aux", screen: 1, memory: 2 }),
    buildCommand("Take", { target: "screen", screen: 1 }),
  ]) {
    assert.ok(
      plan(c).ok,
      `buildCommand produced something that will not compile: ${c}`,
    );
  }
});

check("keyTitle stays short and flags a bad command", () => {
  assert.equal(keyTitle("Recall Screen 1 Memory 5"), "Recall\\nS1\\nM5");
  assert.equal(keyTitle("Recall Screen 99 Memory 1"), "⚠︎");
});

// ---------------------------------------------------------------------------
// The module surface, against the real @companion-module/base
// ---------------------------------------------------------------------------

const { default: ModuleInstance } = await import("../src/main.js");

/** A stand-in for Companion that records what the module registered. */
function harness() {
  const recorded = {};
  const self = Object.create(ModuleInstance.prototype);
  self.state = {
    connected: false,
    model: "",
    label: "",
    presetId: {},
    vendorSelection: [],
    lastCommand: "",
    lastSummary: "",
    lastError: "",
  };
  // `label` is a getter on InstanceBase, so it has to be defined rather than
  // assigned — which is also the point of the test below: presets must build
  // their variable references from it.
  Object.defineProperty(self, "label", {
    value: "aquilon-1",
    configurable: true,
  });
  self.config = { host: "", port: 80 };
  self.setActionDefinitions = (v) => (recorded.actions = v);
  self.setFeedbackDefinitions = (v) => (recorded.feedbacks = v);
  self.setVariableDefinitions = (v) => {
    // Mirrors the real implementation, which THROWS on an array — failing
    // init() and leaving a dead connection with no actions and no visible
    // cause. An earlier version of this stub had the condition inverted, so it
    // happily accepted the array the module was wrongly passing.
    if (Array.isArray(v))
      throw new Error("Variable definitions should be an object, not an array");
    recorded.variableDefs = v;
  };
  self.setVariableValues = (v) =>
    (recorded.variableValues = { ...(recorded.variableValues ?? {}), ...v });
  self.setPresetDefinitions = (structure, presets) => {
    assert.ok(
      Array.isArray(structure),
      "preset structure must be the FIRST argument and an array",
    );
    assert.ok(
      presets && !Array.isArray(presets),
      "preset definitions must be the second argument, an object",
    );
    recorded.presetStructure = structure;
    recorded.presets = presets;
  };
  self.updateStatus = () => {};
  self.log = () => {};
  self.checkAllFeedbacks = () => (recorded.checkedAll = true);
  self.checkFeedbacks = () => {
    throw new Error(
      "bare checkFeedbacks() checks nothing — use checkAllFeedbacks()",
    );
  };
  self.rebuild.call(self);
  return { self, recorded };
}

const { self, recorded } = harness();

check("registers the actions a surface needs", () => {
  for (const id of [
    "command",
    "recall_memory",
    "recall_master",
    "recall_layer_memory",
    "store_memory",
    "take",
  ]) {
    assert.ok(recorded.actions[id], `missing action ${id}`);
  }
});

check("registers feedbacks, none claiming to know program", () => {
  assert.ok(recorded.feedbacks.memory_loaded);
  assert.ok(recorded.feedbacks.connected);
  assert.ok(recorded.feedbacks.vendor_selected);
  for (const [id, def] of Object.entries(recorded.feedbacks)) {
    assert.ok(
      !/program|on.?air/i.test(id),
      `${id} claims to know program, which this module cannot`,
    );
    assert.equal(def.type, "boolean");
  }
});

check("variable definitions are an object keyed by id, not an array", () => {
  assert.ok(recorded.variableDefs && !Array.isArray(recorded.variableDefs));
  for (const [id, d] of Object.entries(recorded.variableDefs)) {
    assert.ok(typeof id === "string" && id.length > 0);
    assert.ok(d.name, `${id} needs a name`);
  }
});

check("every variable set has a definition, and vice versa", () => {
  const defined = new Set(Object.keys(recorded.variableDefs));
  for (const id of Object.keys(recorded.variableValues)) {
    assert.ok(
      defined.has(id),
      `${id} is set but never defined, so it renders as raw text`,
    );
  }
  for (const id of defined) {
    assert.ok(
      id in recorded.variableValues,
      `${id} is defined but never given a value`,
    );
  }
});

check("every preset referenced in the structure exists", () => {
  const referenced = [];
  for (const section of recorded.presetStructure) {
    assert.ok(section.id && section.name, "sections need an id and a name");
    for (const entry of section.definitions) {
      if (typeof entry === "string") referenced.push(entry);
      else {
        assert.equal(entry.type, "simple", "groups must declare their type");
        referenced.push(...entry.presets);
      }
    }
  }
  for (const id of referenced)
    assert.ok(
      recorded.presets[id],
      `structure references a missing preset: ${id}`,
    );
  assert.equal(
    referenced.length,
    Object.keys(recorded.presets).length,
    "every preset should be reachable",
  );
  assert.ok(
    referenced.length > 80,
    `expected a deck's worth of presets, got ${referenced.length}`,
  );
});

check("no preset carries a 1.x category field", () => {
  for (const [id, p] of Object.entries(recorded.presets)) {
    assert.ok(
      !("category" in p),
      `${id} uses the 1.x category field, which loads but never appears`,
    );
    assert.equal(p.type, "simple");
  }
});

check(
  "preset variable references use the connection label, not the module id",
  () => {
    for (const [id, p] of Object.entries(recorded.presets)) {
      const text = p.style?.text ?? "";
      if (!text.includes("$(")) continue;
      assert.ok(
        text.includes(`$(${self.label}:`),
        `${id} hardcodes a variable prefix: ${text}`,
      );
    }
  },
);

check(
  "every preset action names a real action, with a command that compiles",
  () => {
    for (const [id, p] of Object.entries(recorded.presets)) {
      for (const step of p.steps) {
        for (const a of step.down) {
          assert.ok(
            recorded.actions[a.actionId],
            `${id} references unknown action ${a.actionId}`,
          );
          if (a.actionId === "command") {
            const r = plan(a.options.command);
            assert.ok(
              r.ok,
              `${id} carries a command that will not compile: ${a.options.command} — ${r.error ?? ""}`,
            );
          }
        }
      }
    }
  },
);

check("every preset feedback names a real feedback", () => {
  for (const [id, p] of Object.entries(recorded.presets)) {
    for (const f of p.feedbacks) {
      assert.ok(
        recorded.feedbacks[f.feedbackId],
        `${id} references unknown feedback ${f.feedbackId}`,
      );
    }
  }
});

check("variables are populated, and report honestly when disconnected", () => {
  assert.equal(recorded.variableValues.connected, "no");
  assert.equal(recorded.variableValues.screen_1_memory, "");
});

check("a screen's memory variable reports whichever buffers hold one", () => {
  const { self: s2, recorded: r2 } = harness();
  // The device reports against buffers A/B/C; preview/program is not derivable
  // from this alone, and the mapping differs between screens.
  s2.state.presetId.S1 = { A: 901, B: 0 };
  s2.state.presetId.S2 = { A: 0, B: 44 };
  s2.rebuild.call(s2);
  assert.equal(r2.variableValues.screen_1_memory, "901");
  assert.equal(r2.variableValues.screen_2_memory, "44");
});

check("memory_loaded feedback matches whichever buffer holds it", () => {
  const { self: s3, recorded: r3 } = harness();
  s3.state.presetId.S1 = { A: 5 };
  assert.equal(
    r3.feedbacks.memory_loaded.callback({ options: { screen: 1, memory: 5 } }),
    true,
  );
  assert.equal(
    r3.feedbacks.memory_loaded.callback({ options: { screen: 1, memory: 6 } }),
    false,
  );
  assert.equal(
    r3.feedbacks.memory_loaded.callback({ options: { screen: 2, memory: 5 } }),
    false,
  );
});

check("config fields cover host and port", () => {
  const ids = self.getConfigFields.call(self).map((f) => f.id);
  assert.ok(ids.includes("host"));
  assert.ok(ids.includes("port"));
});

check(
  "the module exports UpgradeScripts, and no runEntrypoint call",
  async () => {
    const mod = await import("../src/main.js");
    assert.ok(
      Array.isArray(mod.UpgradeScripts),
      "base 2.x needs UpgradeScripts re-exported",
    );
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8"),
    );
    assert.ok(
      !/runEntrypoint\s*\(/.test(source),
      "runEntrypoint does not exist in base 2.x and breaks packaging",
    );
  },
);

console.log(`${passed} checks passed`);
