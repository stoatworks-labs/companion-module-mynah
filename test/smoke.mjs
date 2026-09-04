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
import { refreshVariables } from "../src/variables.js";

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
  assert.equal(keyTitle("Recall Screen 1 Memory 5"), "Recall\nS1\nM5");
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
  self.config = { host: "", port: 80, builderSlots: 12, macros: "" };
  self.saveConfig = (c) => (recorded.savedConfig = c);
  // init() calls this before rebuild(); the harness has to as well, or the
  // fixture is a shape the module never actually runs in.
  self.loadBuilderConfig.call(self);
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

// --- the parseVariablesInString trap ----------------------------------------
// `parseVariablesInString` and `parseVariablesInField` were removed from
// @companion-module/base 2.x. Neither is on the callback context, on
// InstanceBase, or anywhere in the package. Companion expands a `useVariables`
// option itself before invoking the callback, so the option arrives already
// resolved: the call is redundant as well as fatal, throwing "... is not a
// function" the moment that one action or feedback fires. Nothing else catches
// it — the module loads, init() succeeds, every definition registers, and every
// path that does not make the call keeps working, so the suite passes with the
// bug live. This fixture no longer stubs either function, so a reintroduced
// call now throws here too; the grep is the backstop for a path the fixture
// never exercises. It matches the call form only, so prose naming the
// functions stays legal.
const { readdirSync: pvReadDir, readFileSync: pvReadFile } =
  await import("node:fs");
const pvOffenders = () => {
  const dir = new URL("../src/", import.meta.url).pathname;
  const bad = [];
  for (const f of pvReadDir(dir)) {
    if (!/\.(js|ts)$/.test(f)) continue;
    if (/parseVariablesIn(String|Field)\s*\(/.test(pvReadFile(dir + f, "utf8")))
      bad.push(f);
  }
  return bad;
};

check("no parseVariablesInString/Field call survives in src/", () => {
  assert.deepEqual(
    pvOffenders(),
    [],
    "read the already-resolved event.options value instead",
  );
});

// ---------------------------------------------------------------------------
// The command builder
// ---------------------------------------------------------------------------

const { Builder } = await import("../src/builder.js");
const { STEPS, MACRO_SLOTS: MENU_MACRO_SLOTS } = await import("../src/menu.js");
const { readMacros, writeMacros, setMacro } = await import("../src/macros.js");

/**
 * The drift guard.
 *
 * The step graph is written down rather than derived — `completions()` is a
 * prefix filter over the keyword list, not a next-token oracle, and the parser
 * is a flat clause loop with no tree to walk out of. So the guard is this: walk
 * every path the graph can emit and hand each finished line to `plan()`. The
 * menu may be wrong about taste; it cannot be wrong about legality without
 * turning this red.
 *
 * Loops (the `If` filter, the category chain) are bounded by visiting a step at
 * most twice on one path, which still covers both the first and the repeat
 * spelling of a clause — the two that differ.
 */
function walkMenu() {
  const lines = [];
  const bad = [];
  const missing = new Set();

  const walk = (stepId, tokens, seen) => {
    if (stepId === "end") {
      const line = tokens.join(" ");
      lines.push(line);
      const p = plan(line);
      if (!p.ok) bad.push(`${line} — ${p.error}`);
      return;
    }
    const step = STEPS[stepId];
    if (!step) {
      missing.add(stepId);
      return;
    }
    // Macro steps read saved state rather than emitting words; there is
    // nothing to compile.
    if (step.kind === "macro") return;

    const visits = (seen.get(stepId) ?? 0) + 1;
    if (visits > 2) return;
    const next = new Map(seen);
    next.set(stepId, visits);

    if (step.kind === "number") {
      const samples = [];
      for (const q of (step.quick ?? []).slice(0, 2)) samples.push(q.text);
      samples.push(String(step.min), String(step.max));
      if (step.range && step.max > step.min + 2)
        samples.push(
          `${step.min} Thru ${step.min + 2}`,
          `${step.min} Thru ${step.min + 2} - ${step.min + 1}`,
        );
      for (const v of samples)
        walk(step.next, [...tokens, ...v.split(" ")], next);
      return;
    }

    for (const c of step.choices ?? []) {
      if (c.act) continue; // fire / save / home do not add words
      walk(c.next, c.text ? [...tokens, ...c.text.split(" ")] : tokens, next);
    }
  };

  walk("verb", [], new Map());
  return { lines, bad, missing: [...missing] };
}

const walked = walkMenu();

check("every step the menu points at exists", () => {
  assert.deepEqual(walked.missing, []);
});

check("every command the builder can produce compiles", () => {
  assert.deepEqual(
    walked.bad.slice(0, 5),
    [],
    `${walked.bad.length} of ${walked.lines.length} paths do not compile`,
  );
  assert.ok(
    walked.lines.length > 1000,
    `expected the graph to reach thousands of commands, got ${walked.lines.length}`,
  );
});

check("the builder reaches every verb the module will accept", () => {
  for (const verb of ["Recall", "Store", "Take", "Delete"])
    assert.ok(
      walked.lines.some((l) => l.startsWith(verb)),
      `no path builds a ${verb}`,
    );
  // Label needs a quoted string and there is no text entry on a surface; Set
  // needs live buffer state this module does not track; Select and Clear are
  // refused by plan(). None of them may appear.
  for (const verb of ["Label", "Set", "Select", "Clear"])
    assert.ok(
      !walked.lines.some((l) => l.startsWith(verb)),
      `${verb} is in the menu but cannot work from a surface`,
    );
});

check("a masked master store is reachable, which is the point", () => {
  assert.ok(
    walked.lines.some((l) => /^Store Master \d+ If .*Category /.test(l)),
    "the If filter is the most tedious command to type and must be buildable",
  );
});

/** Press slots by their visible label, which is how an operator does it. */
function pressLabel(b, label) {
  const i = b.view().findIndex((s) => s.label === label);
  assert.ok(
    i >= 0,
    `no slot labelled ${JSON.stringify(label)} — have ${b
      .view()
      .map((s) => s.label)
      .join("|")}`,
  );
  return b.press(i + 1);
}

check("a command can be built entirely out of presses", () => {
  const b = new Builder(12);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen");
  pressLabel(b, "3");
  pressLabel(b, "Memory");
  pressLabel(b, "5");
  assert.equal(b.line, "Recall Screen 3 Memory 5");
  assert.ok(b.valid);
});

check("fire lights before the menu has finished asking", () => {
  // The grammar takes its clauses in any order, so a rigid wizard would be
  // asking for presses the device does not need.
  const b = new Builder(12);
  pressLabel(b, "Take");
  pressLabel(b, "Screen");
  assert.ok(!b.valid, "a verb and an object alone is not a command");
  pressLabel(b, "1");
  assert.ok(b.valid, "Take Screen 1 is complete the moment the screen lands");
  assert.equal(b.line, "Take Screen 1");
});

check("the keypad accumulates digits rather than separate numbers", () => {
  const b = new Builder(12);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen");
  pressLabel(b, "123…");
  pressLabel(b, "2");
  pressLabel(b, "4");
  pressLabel(b, "⏎");
  assert.equal(b.line, "Recall Screen 24", "24, not 2 then 4");
});

check("a range can be typed where the grammar takes one", () => {
  const b = new Builder(15);
  pressLabel(b, "Take");
  pressLabel(b, "Screen");
  pressLabel(b, "123…");
  pressLabel(b, "1");
  pressLabel(b, "Thru");
  pressLabel(b, "4");
  pressLabel(b, "−");
  pressLabel(b, "3");
  pressLabel(b, "⏎");
  assert.equal(b.line, "Take Screen 1 Thru 4 - 3");
  assert.ok(b.valid);
});

check("the range operators are hidden where a range will not parse", () => {
  // `Recall Screen 1 Thru 4 Memory 2` is four recalls of one memory, but
  // `Memory 1 Thru 3` does not parse at all. Offering the key would build a
  // command the grammar refuses.
  const b = new Builder(32);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen");
  pressLabel(b, "1");
  pressLabel(b, "Memory");
  pressLabel(b, "123…");
  const labels = b.view().map((s) => s.label);
  assert.ok(labels.includes("⏎"), "the keypad should still be here");
  for (const op of ["Thru", "+", "−"])
    assert.ok(!labels.includes(op), `${op} must not be offered on a memory`);
});

check("enter is refused on an unfinished expression", () => {
  const b = new Builder(15);
  pressLabel(b, "Take");
  pressLabel(b, "Screen");
  pressLabel(b, "123…");
  pressLabel(b, "1");
  pressLabel(b, "+");
  pressLabel(b, "⏎");
  assert.equal(b.line, "Take Screen", "a trailing + must not commit");
  // A trailing Thru is the exception: `1 Thru` is open-ended.
  const c = new Builder(15);
  pressLabel(c, "Take");
  pressLabel(c, "Screen");
  pressLabel(c, "123…");
  pressLabel(c, "1");
  pressLabel(c, "Thru");
  pressLabel(c, "⏎");
  assert.equal(c.line, "Take Screen 1 Thru");
  assert.ok(c.valid, "an open-ended range is a real command");
});

check("back is an undo, one press at a time", () => {
  const b = new Builder(12);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen");
  pressLabel(b, "3");
  b.back();
  assert.equal(b.line, "Recall Screen");
  b.back();
  assert.equal(b.line, "Recall");
  b.back();
  assert.equal(b.line, "");
  b.back(); // past the start is a no-op, not a crash
  assert.equal(b.line, "");
});

check("the view is always exactly as long as the surface", () => {
  for (const n of [4, 6, 12, 15, 32]) {
    const b = new Builder(n);
    assert.equal(b.view().length, n);
    pressLabel(b, "Recall");
    assert.equal(b.view().length, n, "a short list must still blank the rest");
    assert.ok(
      b.view().every((s) => typeof s.label === "string"),
      "a slot with nothing in it keeps the last step's label unless blanked",
    );
  }
});

check("a long list pages, and the keypad key survives every page", () => {
  const b = new Builder(6);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen"); // 24 screens over five slots a page
  assert.ok(b.pageCount() > 1);
  const seen = new Set();
  for (let i = 0; i < b.pageCount(); i++) {
    assert.ok(
      b.view().some((s) => s.label === "123…"),
      `page ${i} has no way to the keypad`,
    );
    for (const s of b.view()) if (s.label !== "") seen.add(s.label);
    b.more();
  }
  assert.ok(seen.has("24"), "every screen should be reachable by paging");
});

check("macros survive a round trip through the config field", () => {
  let macros = readMacros("");
  assert.equal(macros.length, MENU_MACRO_SLOTS);
  assert.ok(macros.every((m) => m === null));

  macros = setMacro(macros, 3, "Recall Screen 1 Memory 5");
  const raw = writeMacros(macros);
  const back = readMacros(raw);
  assert.equal(back[2].line, "Recall Screen 1 Memory 5");
  assert.ok(back[2].label.includes("S1"), "a macro labels its own key");
  assert.equal(back[0], null);
});

check("a broken macro field costs the macros, not the connection", () => {
  // The field is hand-editable on purpose, so it is a field a human can break.
  for (const raw of ["{", "null", "[1,2,3]", '{"line":"x"}', "[]"]) {
    const m = readMacros(raw);
    assert.equal(m.length, MENU_MACRO_SLOTS);
    assert.ok(m.every((e) => e === null || typeof e.line === "string"));
  }
});

check("saving asks which slot, and loading puts it back on the line", () => {
  const b = new Builder(12);
  pressLabel(b, "Recall");
  pressLabel(b, "Screen");
  pressLabel(b, "1");
  pressLabel(b, "Memory");
  pressLabel(b, "7");

  const asked = b.act({ type: "save" });
  assert.equal(asked, undefined, "a valid line goes to the slot picker");
  assert.equal(b.stepId, "macro_save");

  b.macroLabels = ["", "", ""];
  const effect = b.press(2);
  assert.deepEqual(effect, { saveTo: 2 });

  b.loadLine("Recall Screen 1 Memory 7");
  assert.equal(b.line, "Recall Screen 1 Memory 7");
  assert.ok(b.valid);
});

check("save is refused with a reason when there is nothing to save", () => {
  const b = new Builder(12);
  pressLabel(b, "Recall");
  const refused = b.act({ type: "save" });
  assert.ok(refused?.refuse, "an empty save must say why, not fail silently");
});

check("an empty macro slot cannot be fired", () => {
  const b = new Builder(12);
  b.macroLabels = ["", "Take S1"];
  b.stepId = "macro_run";
  assert.equal(b.press(1), undefined, "slot 1 is empty");
  assert.deepEqual(b.press(2), { load: 2 });
});

// --- the builder against the module surface ---------------------------------

check("registers the builder and macro actions", () => {
  for (const id of [
    "builder_slot",
    "builder_back",
    "builder_home",
    "builder_more",
    "builder_fire",
    "builder_save",
    "macro_run",
    "macro_edit",
    "macro_store_current",
    "macro_delete",
  ])
    assert.ok(recorded.actions[id], `missing action ${id}`);
});

check("a slot press repaints the faces, or the key looks dead", () => {
  // The slot faces ARE the interface. A press that advances the state without
  // pushing new variable values leaves the operator looking at the previous
  // step's words on live keys, which is worse than a key that does nothing.
  const { self: s4, recorded: r4 } = harness();
  s4.onStateChanged = () => {
    refreshVariables(s4);
    s4.checkAllFeedbacks();
  };
  assert.equal(r4.variableValues.b1, "Recall");

  r4.actions.builder_slot.callback({ options: { slot: 1 } });
  assert.equal(s4.builder.line, "Recall");
  assert.equal(
    r4.variableValues.b1,
    "Screen",
    "the faces still show the previous step",
  );
  assert.ok(r4.checkedAll, "the slot colours have to be re-evaluated too");
});

check("firing an unfinished line refuses instead of writing", () => {
  const { self: s5, recorded: r5 } = harness();
  s5.onStateChanged = () => {};
  r5.actions.builder_fire.callback({});
  assert.ok(
    s5.builder.message !== "",
    "an empty fire must leave a reason on the line",
  );
});

check("saving a macro writes the config back", () => {
  const { self: s6, recorded: r6 } = harness();
  s6.onStateChanged = () => {};
  s6.builder.loadLine("Take Screen 2");
  r6.actions.macro_store_current.callback({ options: { slot: 4 } });
  assert.ok(
    r6.savedConfig,
    "saveConfig is the only durable store a module has",
  );
  assert.equal(readMacros(r6.savedConfig.macros)[3].line, "Take Screen 2");
  assert.equal(s6.macros[3].line, "Take Screen 2");
});

check("every builder slot has a variable, a preset and a face", () => {
  for (let n = 1; n <= 32; n++) {
    assert.ok(recorded.variableDefs[`b${n}`], `b${n} is not defined`);
    assert.ok(
      recorded.presets[`builder_slot_${n}`],
      `no preset for slot ${n} — it could never be dragged out`,
    );
  }
  assert.equal(recorded.variableValues.b1, "Recall");
  assert.equal(
    recorded.variableValues.b32,
    "",
    "slots past the configured count must be blank",
  );
});

console.log(`${passed} checks passed`);
