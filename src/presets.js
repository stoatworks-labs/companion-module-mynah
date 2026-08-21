import { combineRgb } from "@companion-module/base";

/**
 * The preset library — this is what populates a Stream Deck.
 *
 * Companion's preset panel is the mechanism: a module ships definitions, the
 * operator drags them onto keys. So "populating a deck" means shipping enough
 * ready-made buttons that a page of memory recalls is a drag away rather than
 * a hundred hand-typed commands.
 *
 * Note `setPresetDefinitions` takes TWO arguments in base 2.x — a structure of
 * sections and groups, then the definitions. A 1.x-style `category` field on a
 * definition still loads, and the presets simply never appear, which reads as
 * a rendering bug rather than a mistake.
 *
 * Every button carries a plain Mynah command, so what a key does is legible in
 * the button's own action rather than hidden behind a numeric opcode.
 */

const WHITE = combineRgb(255, 255, 255);
const BLACK = combineRgb(0, 0, 0);
const DARK = combineRgb(20, 24, 30);
const GREEN = combineRgb(45, 140, 75);
const AMBER = combineRgb(180, 130, 40);
const RED = combineRgb(150, 45, 45);
const BLUE = combineRgb(40, 90, 140);

/** How many of each to generate. Enough to fill a page, not the whole bank. */
const SCREENS = 4;
const SCREEN_MEMORIES = 12;
const MASTER_MEMORIES = 24;
const LAYER_MEMORIES = 8;
const TAKE_SCREENS = 8;
const STORE_MEMORIES = 4;

const button = (
  name,
  text,
  bgcolor,
  actions,
  feedbacks = [],
  color = WHITE,
) => ({
  type: "simple",
  name,
  style: { text, size: "14", color, bgcolor },
  steps: [{ down: actions, up: [] }],
  feedbacks,
});

const cmd = (command) => [{ actionId: "command", options: { command } }];

export default function UpdatePresets(self) {
  const presets = {};
  const sections = [];

  // --- Transport ----------------------------------------------------------

  const takeIds = [];
  for (let s = 1; s <= TAKE_SCREENS; s++) {
    const id = `take_s${s}`;
    presets[id] = button(
      `Take Screen ${s}`,
      `TAKE\\nS${s}`,
      RED,
      cmd(`Take Screen ${s}`),
    );
    takeIds.push(id);
  }
  presets.take_all = button(
    `Take Screens 1 thru ${SCREENS}`,
    `TAKE\\n1-${SCREENS}`,
    RED,
    cmd(`Take Screen 1 Thru ${SCREENS}`),
  );
  takeIds.push("take_all");

  sections.push({
    id: "transport",
    name: "Transport",
    description:
      "Transition preview to program. These reach air — nothing else here does.",
    definitions: [
      { id: "take", type: "simple", name: "Take", presets: takeIds },
    ],
  });

  // --- Screen memories ----------------------------------------------------

  const screenGroups = [];
  for (let s = 1; s <= SCREENS; s++) {
    const ids = [];
    for (let m = 1; m <= SCREEN_MEMORIES; m++) {
      const id = `recall_s${s}_m${m}`;
      presets[id] = button(
        `Recall memory ${m} to Screen ${s} preview`,
        `S${s}\\nMEM ${m}`,
        GREEN,
        cmd(`Recall Screen ${s} Memory ${m}`),
        [
          {
            feedbackId: "memory_loaded",
            options: { screen: s, memory: m },
            style: { bgcolor: AMBER, color: BLACK },
          },
        ],
      );
      ids.push(id);
    }
    screenGroups.push({
      id: `screen_${s}_memories`,
      type: "simple",
      name: `Screen ${s}`,
      presets: ids,
    });
  }

  sections.push({
    id: "screen_memories",
    name: "Screen memories",
    description:
      "Recall into Preview. The button lights when that memory is loaded on the screen — which does not distinguish preview from program, because the device does not report that directly.",
    definitions: screenGroups,
  });

  // --- Master memories ----------------------------------------------------

  const masterIds = [];
  for (let m = 1; m <= MASTER_MEMORIES; m++) {
    const id = `recall_master_${m}`;
    presets[id] = button(
      `Recall master memory ${m} to preview`,
      `MASTER\\n${m}`,
      BLUE,
      cmd(`Recall Master ${m}`),
    );
    masterIds.push(id);
  }
  sections.push({
    id: "master_memories",
    name: "Master memories",
    description: "Recall a whole-desk memory into Preview.",
    definitions: [
      { id: "master", type: "simple", name: "Master", presets: masterIds },
    ],
  });

  // --- Layer memories -----------------------------------------------------

  const layerGroups = [];
  for (let s = 1; s <= 2; s++) {
    const ids = [];
    for (let m = 1; m <= LAYER_MEMORIES; m++) {
      const id = `recall_s${s}_l1_m${m}`;
      presets[id] = button(
        `Recall layer memory ${m} to Screen ${s} layer 1`,
        `S${s} L1\\nMEM ${m}`,
        combineRgb(90, 60, 130),
        cmd(`Recall Screen ${s} Layer 1 Memory ${m}`),
      );
      ids.push(id);
    }
    layerGroups.push({
      id: `layer_s${s}`,
      type: "simple",
      name: `Screen ${s} layer 1`,
      presets: ids,
    });
  }
  sections.push({
    id: "layer_memories",
    name: "Layer memories",
    description: "Layer memories are a separate bank and only go up to 50.",
    definitions: layerGroups,
  });

  // --- Select -------------------------------------------------------------

  const selectIds = [];
  for (let s = 1; s <= TAKE_SCREENS; s++) {
    const id = `vendor_screen_${s}`;
    presets[id] = button(
      `Screen ${s} tally`,
      `S${s}`,
      DARK,
      // No action: this is an indicator of the vendor UI's own selection, and
      // a button that looks pressable but does nothing would be worse.
      [],
      [
        {
          feedbackId: "vendor_selected",
          options: { screen: s },
          style: { bgcolor: AMBER, color: BLACK },
        },
      ],
    );
    selectIds.push(id);
  }
  sections.push({
    id: "indicators",
    name: "Indicators",
    description:
      "Which screens are selected in Analog Way's own Web RCS, which rides the same socket.",
    definitions: [
      {
        id: "tally",
        type: "simple",
        name: "Vendor selection",
        presets: selectIds,
      },
    ],
  });

  // --- Store --------------------------------------------------------------

  const storeIds = [];
  for (let s = 1; s <= SCREENS; s++) {
    for (let m = 1; m <= STORE_MEMORIES; m++) {
      const id = `store_s${s}_m${m}`;
      presets[id] = button(
        `Store Screen ${s} program into memory ${m}`,
        `STORE\\nS${s} M${m}`,
        combineRgb(70, 20, 20),
        cmd(`Store Screen ${s} Memory ${m}`),
      );
      storeIds.push(id);
    }
  }
  sections.push({
    id: "store",
    name: "Store",
    description:
      "Overwrites a memory with what is on program. Kept visually distinct because there is no undo on the device.",
    definitions: [
      {
        id: "store_screen",
        type: "simple",
        name: "Store screen memory",
        presets: storeIds,
      },
    ],
  });

  // --- Status -------------------------------------------------------------

  // Variable references must use the connection's LABEL, not the module id —
  // a hardcoded id renders as raw $(...) text on a renamed connection or a
  // second instance.
  presets.status_connected = button(
    "Connection status",
    `MYNAH\\n$(${self.label}:connected)`,
    DARK,
    [],
    [
      {
        feedbackId: "connected",
        options: {},
        style: { bgcolor: GREEN, color: WHITE },
      },
    ],
  );
  presets.status_last = button(
    "Last command",
    `$(${self.label}:last_summary)`,
    DARK,
    [],
  );

  sections.push({
    id: "status",
    name: "Status",
    definitions: [
      {
        id: "status",
        type: "simple",
        name: "Status",
        presets: ["status_connected", "status_last"],
      },
    ],
  });

  self.setPresetDefinitions(sections, presets);
}
