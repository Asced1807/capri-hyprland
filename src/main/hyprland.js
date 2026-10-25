'use strict';

// Hyprland support. Electron can't do on Wayland what Capri does on Windows (forwarded mouse
// moves, always-on-top, reading where the other windows are), so we ask the compositor itself,
// over its IPC socket: where the pointer is, which windows are on screen, which one has focus.
// Only positions and sizes are read, never titles or contents.

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { execFile } = require('node:child_process');

const SIGNATURE = process.env.HYPRLAND_INSTANCE_SIGNATURE;

function isHyprland() {
  return process.platform === 'linux' && Boolean(SIGNATURE);
}

function socketPath(name = '.socket.sock') {
  const runtime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;
  const modern = path.join(runtime, 'hypr', SIGNATURE, name);
  return fs.existsSync(modern) ? modern : path.join('/tmp', 'hypr', SIGNATURE, name);
}

// One request on the command socket, e.g. 'j/clients'. Resolves with the parsed JSON.
function request(command, timeout = 500) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sock = net.createConnection(socketPath());
    sock.setTimeout(timeout, () => sock.destroy(new Error('hyprland socket timeout')));
    sock.on('connect', () => sock.write(command));
    sock.on('data', (chunk) => chunks.push(chunk));
    sock.on('error', reject);
    sock.on('close', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
  });
}

const hyprctl = (args) => new Promise((resolve) => {
  execFile('hyprctl', args, { timeout: 3000 }, (err, stdout) => resolve(err ? '' : String(stdout)));
});

// What the overlay needs from the compositor: floating over everything, on every workspace,
// not grabbing focus by itself, no decorations, no blur and no opacity rule from the user's config,
// covering the whole monitor. Runtime rules: nothing is written to the user's config.
const RULE = {
  float: true,
  pin: true,
  // not no_focus: Hyprland doesn't send the pointer to such a window, and she couldn't be
  // clicked or dragged. Hovering her doesn't focus her; a click does, and refocus() undoes it.
  no_follow_mouse: true,
  no_initial_focus: true,
  border_size: 0,
  no_shadow: true,
  no_blur: true,
  no_anim: true,
  no_dim: true,
  rounding: 0,
  opaque: true,
  render_unfocused: true,
  size: 'monitor_w monitor_h',
  move: '0 0',
};

// hyprctl answers "ok" or the reason it refused the rule
const report = (out) => {
  if (out && out.trim() !== 'ok') console.error('[capri] hyprland window rule:', out.trim());
};

function luaValue(v) {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

// Matched on the title too: the demo's little terminal is another window of the same app.
const TITLE = '^(Capri)$';
const DEMO_TITLE = '^(night-city-api.*)$';

async function applyWindowRules(className) {
  const status = await hyprctl(['status']);
  const match = `^(${className})$`;
  if (/configProvider:\s*lua/.test(status)) {
    const props = Object.entries(RULE).map(([k, v]) => `${k} = ${luaValue(v)}`).join(', ');
    report(await hyprctl(['eval', `hl.window_rule({ name = "capri-overlay", match = { class = ${JSON.stringify(match)}, title = ${JSON.stringify(TITLE)} }, ${props} })`]));
    // the demo's little terminal: floating at its own size, so she can sit on it and possess it
    report(await hyprctl(['eval', `hl.window_rule({ name = "capri-demo", match = { class = ${JSON.stringify(match)}, title = ${JSON.stringify(DEMO_TITLE)} }, float = true, size = "620 300", no_initial_focus = true })`]));
    return 'lua';
  }
  // hyprlang (.conf), windowrule v3 syntax (Hyprland 0.53+)
  const props = Object.entries(RULE).map(([k, v]) => `${k} ${v === true ? 'on' : v}`).join(', ');
  report(await hyprctl(['keyword', 'windowrule', `${props}, match:class ${match}, match:title ${TITLE}`]));
  report(await hyprctl(['keyword', 'windowrule', `float on, size 620 300, no_initial_focus on, match:class ${match}, match:title ${DEMO_TITLE}`]));
  return 'conf';
}

// A config reload drops runtime rules: put ours back each time (caelestia reloads on every
// wallpaper or scheme change). Listens on the event socket, reconnects if Hyprland restarts it.
function keepWindowRules(className) {
  let stopped = false;
  let sock = null;
  const connect = () => {
    if (stopped) return;
    let pending = '';
    sock = net.createConnection(socketPath('.socket2.sock'));
    sock.setEncoding('utf8');
    sock.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      if (lines.some((l) => l.startsWith('configreloaded>>'))) applyWindowRules(className);
    });
    sock.on('error', () => {});
    sock.on('close', () => setTimeout(connect, 3000));
  };
  connect();
  return {
    stop() {
      stopped = true;
      sock?.destroy();
    },
  };
}

// Same feed as the Windows helper: { fg, wins } with the visible windows front first,
// in overlay coordinates. Plus the pointer, which Wayland won't forward to a click-through window.
function startHyprlandWatch({ overlay, onUpdate, onPointer }) {
  let stopped = false;
  let origin = { x: 0, y: 0, monitor: null };
  let lastSnap = '';
  let lastOther = null; // the focused window before a click on her focused the overlay
  let lastPointer = '';
  let pointer = { x: 0, y: 0, inside: false };

  const bounds = () => {
    const b = overlay.getBounds();
    return { w: b.width, h: b.height };
  };

  async function snapshot() {
    const [clients, monitors, active] = await Promise.all([
      request('j/clients'), request('j/monitors'), request('j/activewindow'),
    ]);
    // her own overlay; the demo's terminal is ours too, but she sits on that one
    const isSelf = (c) => c.pid === process.pid && c.title === 'Capri';
    const self = clients.find((c) => isSelf(c) && c.mapped);
    const monitor = monitors.find((m) => (self ? m.id === self.monitor : m.focused)) || monitors[0];
    if (!monitor) return;
    origin = self ? { x: self.at[0], y: self.at[1], monitor: monitor.id } : { x: monitor.x, y: monitor.y, monitor: monitor.id };
    const special = monitor.specialWorkspace?.id || 0;
    const shown = new Set([monitor.activeWorkspace?.id, special].filter(Boolean));
    const { w: vw, h: vh } = bounds();

    // front first: an open special workspace over everything, then fullscreen,
    // then floating, then tiled; inside each, the most recently focused first
    const layer = (c) => (special && c.workspace.id === special ? 0 : 4) + (c.fullscreen ? 0 : c.floating ? 1 : 2);
    const wins = clients
      .filter((c) => c.mapped && !c.hidden && !isSelf(c) && shown.has(c.workspace.id))
      .filter((c) => c.size[0] >= 200 && c.size[1] >= 120)
      .sort((a, b) => layer(a) - layer(b) || a.focusHistoryID - b.focusHistoryID)
      .slice(0, 40)
      .map((c) => ({
        id: c.address,
        x: c.at[0] - origin.x,
        y: c.at[1] - origin.y,
        w: c.size[0],
        h: c.size[1],
        max: Boolean(c.fullscreen),
      }))
      .filter((w) => w.x < vw && w.x + w.w > 0 && w.y < vh && w.y + w.h > 0);
    if (active?.address && !isSelf(active)) lastOther = active.address;
    // clicking her focuses the overlay for a moment: as far as she knows, focus didn't move
    const snap = { fg: lastOther, wins };
    const text = JSON.stringify(snap);
    if (text !== lastSnap) {
      lastSnap = text;
      onUpdate(snap);
    }
  }

  async function poll() {
    const p = await request('j/cursorpos');
    const { w, h } = bounds();
    const x = p.x - origin.x, y = p.y - origin.y;
    pointer = { x, y, inside: x >= 0 && y >= 0 && x < w && y < h };
    const text = `${x},${y},${pointer.inside}`;
    if (text !== lastPointer) {
      lastPointer = text;
      onPointer(pointer);
    }
  }

  const loop = (fn, every) => {
    const tick = async () => {
      if (stopped || overlay.isDestroyed()) return;
      try {
        await fn();
      } catch {
        // compositor busy or restarting: try again next tick
      }
      setTimeout(tick, every);
    };
    tick();
  };
  loop(snapshot, 150);
  loop(poll, 33);

  return {
    cursor: () => pointer,
    // give the keyboard back to the window you were on, once you let go of her
    async refocus() {
      try {
        const active = await request('j/activewindow');
        if (active?.pid === process.pid && active.title === 'Capri' && lastOther) {
          await hyprctl(['dispatch', `hl.dsp.focus({ window = "address:${lastOther}" })`]);
        }
      } catch {
        // nothing to give back
      }
    },
    stop() {
      stopped = true;
    },
  };
}

module.exports = { isHyprland, applyWindowRules, keepWindowRules, startHyprlandWatch };
