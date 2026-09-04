import { InstanceBase, InstanceStatus, Regex } from "@companion-module/base";

import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions, { refreshVariables } from "./variables.js";
import UpdatePresets from "./presets.js";
import { api } from "./api.js";
import { Builder } from "./builder.js";
import { readMacros, macroLabels } from "./macros.js";
import { VERIFIED_FIRMWARE } from "./lang.js";
import { aboutField } from "./about-field.js";

/**
 * Note there is no `runEntrypoint` call at the bottom of this file.
 * `@companion-module/base` 2.x does not export one — a module default-exports
 * its InstanceBase subclass and re-exports UpgradeScripts. The 1.x call still
 * imports and runs under `node --test`, so a full unit suite passes while
 * `companion-module-build` fails and the module can never be packaged.
 * `npm run package` is the only check that catches it.
 */
export default class ModuleInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.state = {
      connected: false,
      model: "",
      label: "",
      presetId: {},
      vendorSelection: [],
      lastCommand: "",
      lastSummary: "",
      lastError: "",
    };

    // The builder holds the half-built command. It is per-connection, not per
    // surface: the action event does carry a `surfaceId`, but variables and
    // feedbacks belong to the connection, so two decks on the same page would
    // show the same faces anyway. See docs/BUILDER.md.
    this.builder = new Builder(12);
    this.macros = readMacros("");
  }

  async init(config) {
    this.config = config;
    this.loadBuilderConfig();
    this.onStateChanged = () => {
      refreshVariables(this);
      // A bare checkFeedbacks() checks NOTHING — it forwards [undefined] as a
      // feedback type, so every feedback silently freezes at its last value.
      this.checkAllFeedbacks();
    };
    this.rebuild();
    this.updateStatus(InstanceStatus.Connecting);
    api.connect(this);
  }

  async destroy() {
    api.close();
  }

  async configUpdated(config) {
    this.config = config;
    this.loadBuilderConfig();
    api.close();
    this.rebuild();
    api.connect(this);
  }

  /**
   * Re-read the two builder settings.
   *
   * The slot count cannot be worked out from the surface — a module is never
   * told how big a Stream Deck is — so it is a config field, and the builder
   * has to be told again whenever the config changes.
   */
  loadBuilderConfig() {
    this.builder = new Builder(this.config?.builderSlots ?? 12);
    this.macros = readMacros(this.config?.macros);
    this.builder.macroLabels = macroLabels(this.macros);
  }

  rebuild() {
    UpdateActions(this);
    UpdateFeedbacks(this);
    UpdateVariableDefinitions(this);
    UpdatePresets(this);
    refreshVariables(this);
  }

  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Connection",
        value:
          "Point this at an Analog Way LivePremier (Aquilon). It speaks the same <b>Web RCS WebSocket</b> the vendor's own browser UI uses, on port 80 of a device or 3000 of the simulator — so it needs nothing installed on the switcher, and it sees changes a human makes in the Web RCS. The socket is <b>unauthenticated</b>: anyone who can reach the port can drive the switcher, so keep it on a trusted network.",
      },
      {
        type: "textinput",
        id: "host",
        label: "Device address",
        width: 8,
        default: "",
        regex: Regex.HOSTNAME,
      },
      {
        type: "number",
        id: "port",
        label: "Port (80 on a device, 3000 on the simulator)",
        width: 4,
        default: 80,
        min: 1,
        max: 65535,
      },
      {
        type: "static-text",
        id: "firmware",
        width: 12,
        label: "Firmware",
        value: `Paths were verified against firmware <b>${VERIFIED_FIRMWARE}</b> on a physical Aquilon C. Analog Way has moved control paths between firmware versions before, so a much older or newer device may not respond to everything here.`,
      },
      {
        type: "number",
        id: "builderSlots",
        label: "Command builder — slot keys",
        width: 4,
        default: 12,
        min: 4,
        max: 32,
        tooltip:
          "How many keys on your page are builder slots. A module is never told how big a surface is, so it has to be told here. Twelve puts the whole keypad except Thru/+/- on one page.",
      },
      {
        type: "static-text",
        id: "builder_info",
        width: 8,
        label: "Command builder",
        value:
          "Drag the <b>Command builder</b> presets onto a page: the slot keys, then Back, Home, More, Fire and Save. The slots relabel themselves as you press — a module cannot make a surface change page, so the page stays put and the faces change.",
      },
      {
        type: "textinput",
        id: "macros",
        label: "Saved macros (JSON)",
        width: 12,
        default: "",
        tooltip:
          "Written by the builder's Save key. Hand-editable on purpose: this is what makes a macro set readable and shareable. A malformed value costs the macros, not the connection.",
      },
      aboutField(),
    ];
  }
}

export { UpgradeScripts };
