import WebSocket from "ws";
import { InstanceStatus } from "@companion-module/base";

/**
 * The Web RCS WebSocket — the socket the vendor's own browser UI speaks.
 *
 * Undocumented, recovered from the Web RCS bundle and verified on a physical
 * Aquilon C (firmware 6.2.73). It is used in preference to the documented AWJ
 * protocol on TCP 10606 because AWJ is capped at five concurrent clients, its
 * subscriptions are empty until a client writes a subscription list, and it
 * cannot enumerate anything. This socket pushes state unsolicited from the
 * moment it opens and has no documented client cap.
 *
 *   {"channel":"DEVICE","data":{"path":["device",…],"value":…}}
 *
 * The same envelope goes both ways — writing a property *is* the command.
 * Keepalives are bare text frames, `0x9` out and `0xA` back, which are not
 * WebSocket control frames and not JSON.
 *
 * `ws` is used rather than Node 22's global WebSocket: the global is still
 * flagged experimental, and a control surface should not be the place that
 * discovers a runtime changed its mind about it.
 */

const PING = "0x9";
const PONG = "0xA";

/** Idle time before pinging starts, and the gap between pings thereafter. */
const PING_SILENT_MS = 3000;
const PING_INTERVAL_MS = 1000;

/** How long to wait before retrying a dropped connection. */
const RECONNECT_MS = 5000;

class Api {
  constructor() {
    this.ws = undefined;
    this.self = undefined;
    this.idleTimer = undefined;
    this.pingTimer = undefined;
    this.reconnectTimer = undefined;
    this.closing = false;
  }

  connect(self) {
    this.self = self;
    this.closing = false;
    this.clearTimers();

    const host = (self.config?.host ?? "").trim();
    if (host === "") {
      self.updateStatus(InstanceStatus.BadConfig, "No device address");
      return;
    }
    const port = Number(self.config?.port) || 80;
    const url = `ws://${host}:${port}/`;

    self.updateStatus(InstanceStatus.Connecting);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      self.updateStatus(
        InstanceStatus.ConnectionFailure,
        String(e?.message ?? e),
      );
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.on("open", () => {
      self.updateStatus(InstanceStatus.Ok);
      self.state.connected = true;
      this.restartPing();
      self.onStateChanged?.();
    });

    ws.on("message", (raw) => {
      const text = raw.toString();

      // The device pings us too, and expects the answer.
      if (text === PING) {
        this.sendRaw(PONG);
        return;
      }
      if (text === PONG) return;

      this.restartPing();

      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      this.handle(msg);
    });

    ws.on("error", (e) => {
      self.log("error", `Web RCS socket error: ${e?.message ?? e}`);
      self.updateStatus(
        InstanceStatus.ConnectionFailure,
        String(e?.message ?? e),
      );
    });

    ws.on("close", () => {
      this.clearTimers();
      self.state.connected = false;
      self.onStateChanged?.();
      if (!this.closing) {
        self.updateStatus(InstanceStatus.Disconnected);
        this.scheduleReconnect();
      }
    });
  }

  handle(msg) {
    const self = this.self;
    if (!self || typeof msg !== "object" || msg === null) return;

    if (msg.channel === "DEVICE") {
      const d = msg.data;
      if (!d || !Array.isArray(d.path)) return;
      this.onDeviceValue(self, d.path.map(String), d.value);
      return;
    }

    if (msg.channel === "REMOTE") {
      this.onRemote(self, msg.data);
    }
  }

  /**
   * Track just enough device state to drive feedbacks and variables.
   *
   * Deliberately not a mirror of the object model: the socket pushes only
   * *changes*, and the one HTTP read that would seed a full model is 124 MB
   * with no way to narrow it. So this keeps the handful of values a control
   * surface actually shows.
   */
  onDeviceValue(self, path, value) {
    const key = path.join("/");

    // Which memory currently sits in a screen's buffer. The buffer is keyed
    // A/B/C, *not* preview/program — those are names for whichever buffer is
    // pending or live, and which is which differs between screens on the same
    // device. So this records the memory per buffer and claims nothing about
    // preview versus program.
    const preset =
      /^device\/presetBank\/status\/presetId\/screenList\/items\/(S\d+)\/presetList\/items\/([ABC])\/pp\/id$/.exec(
        key,
      );
    if (preset) {
      const [, screen, buffer] = preset;
      self.state.presetId[screen] ??= {};
      self.state.presetId[screen][buffer] = Number(value) || 0;
      self.onStateChanged?.();
      return;
    }

    if (key === "device/system/deviceList/items/1/pp/dev") {
      self.state.model = String(value ?? "");
      self.onStateChanged?.();
      return;
    }

    if (key === "device/system/deviceList/items/1/pp/label") {
      self.state.label = String(value ?? "");
      self.onStateChanged?.();
    }
  }

  /** The vendor UI's own screen selection, mirrored so both agree. */
  onRemote(self, data) {
    if (typeof data !== "object" || data === null) return;

    let keys;
    if (data.channel === "INIT") {
      keys = data.snapshot?.live?.screens?.screenAuxSelection?.keys;
    } else if (
      data.channel === "PATCH" &&
      typeof data.patch?.path === "string"
    ) {
      if (!data.patch.path.startsWith("/live/screens/screenAuxSelection"))
        return;
      keys = data.patch.value;
    }
    if (!Array.isArray(keys)) return;

    self.state.vendorSelection = keys.map(String);
    self.onStateChanged?.();
  }

  /**
   * Write one property. This *is* the command — there is no separate verb.
   *
   * Ops go out as a burst without waiting for echoes. Ordering on a single
   * socket is guaranteed, and a masked master store depends on its filters
   * landing before its trigger, so a round trip per op would only be slower
   * for no gain.
   */
  write(path, value) {
    return this.sendRaw(
      JSON.stringify({ channel: "DEVICE", data: { path, value } }),
    );
  }

  sendRaw(text) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(text);
    return true;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Ping only once the link has gone quiet, matching the vendor client. On a
   * busy device its own push traffic is proof of life.
   */
  restartPing() {
    this.clearPing();
    this.idleTimer = setTimeout(() => {
      this.pingTimer = setInterval(() => this.sendRaw(PING), PING_INTERVAL_MS);
    }, PING_SILENT_MS);
  }

  clearPing() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.idleTimer = undefined;
    this.pingTimer = undefined;
  }

  clearTimers() {
    this.clearPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  scheduleReconnect() {
    if (this.closing) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.closing && this.self) this.connect(this.self);
    }, RECONNECT_MS);
  }

  close() {
    this.closing = true;
    this.clearTimers();
    try {
      this.ws?.close();
    } catch {
      // Already gone; nothing to do.
    }
    this.ws = undefined;
  }
}

export const api = new Api();
