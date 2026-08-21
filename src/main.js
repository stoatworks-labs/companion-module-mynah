import { InstanceBase, InstanceStatus, Regex } from "@companion-module/base";

import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions, { refreshVariables } from "./variables.js";
import UpdatePresets from "./presets.js";
import { api } from "./api.js";
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
  }

  async init(config) {
    this.config = config;
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
    api.close();
    this.rebuild();
    api.connect(this);
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
      aboutField(),
    ];
  }
}

export { UpgradeScripts };
