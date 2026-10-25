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
  // Electron's click-through (setIgnoreMouseEvents) doesn't work on Wayland: the overlay would
  // take the pointer over the whole screen (no wheel, no scrollbars, no clicks anywhere).
  // no_focus makes Hyprland skip her for the pointer entirely, and it's lifted with set_prop
  // only while the pointer is over her body (setPassThrough), so she can be clicked and dragged.
  no_focus: true,
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
const NAME_TITLE = '^(Capri · .*)$';

// Super+Alt+C puts her away (Ctrl+Alt+C is caelestia's "clear notifications").
// Goes through the bridge, like a hook would.
const BIND = { mods: 'SUPER + ALT', modmask: 64 + 8, key: 'C' };
const TOGGLE = `curl -s -X POST http://127.0.0.1:${Number(process.env.CAPRI_PORT) || 47823}/toggle`;

async function applyBind(lua) {
  // already there (Capri restarted without a reload): binding it twice would toggle twice
  const binds = await request('j/binds').catch(() => []);
  if (binds.some((b) => b.modmask === BIND.modmask && b.key.toUpperCase() === BIND.key)) return;
  if (lua) report(await hyprctl(['eval', `hl.bind(${JSON.stringify(`${BIND.mods} + ${BIND.key}`)}, hl.dsp.exec_cmd(${JSON.stringify(TOGGLE)}))`]));
  else report(await hyprctl(['keyword', 'bind', `${BIND.mods.replace(' + ', ' ')}, ${BIND.key}, exec, ${TOGGLE}`]));
}

async function applyWindowRules(className) {
  const status = await hyprctl(['status']);
  const match = `^(${className})$`;
  if (/configProvider:\s*lua/.test(status)) {
    const props = Object.entries(RULE).map(([k, v]) => `${k} = ${luaValue(v)}`).join(', ');
    report(await hyprctl(['eval', `hl.window_rule({ name = "capri-overlay", match = { class = ${JSON.stringify(match)}, title = ${JSON.stringify(TITLE)} }, ${props} })`]));
    // the demo's little terminal: floating at its own size, so she can sit on it and possess it
    report(await hyprctl(['eval', `hl.window_rule({ name = "capri-demo", match = { class = ${JSON.stringify(match)}, title = ${JSON.stringify(DEMO_TITLE)} }, float = true, size = "620 300", no_initial_focus = true })`]));
    report(await hyprctl(['eval', `hl.window_rule({ name = "capri-name", match = { class = ${JSON.stringify(match)}, title = ${JSON.stringify(NAME_TITLE)} }, float = true, size = "380 170" })`]));
    await applyBind(true);
    return 'lua';
  }
  // hyprlang (.conf), windowrule v3 syntax (Hyprland 0.53+)
  const props = Object.entries(RULE).map(([k, v]) => `${k} ${v === true ? 'on' : v}`).join(', ');
  report(await hyprctl(['keyword', 'windowrule', `${props}, match:class ${match}, match:title ${TITLE}`]));
  report(await hyprctl(['keyword', 'windowrule', `float on, size 620 300, no_initial_focus on, match:class ${match}, match:title ${DEMO_TITLE}`]));
  report(await hyprctl(['keyword', 'windowrule', `float on, size 380 170, match:class ${match}, match:title ${NAME_TITLE}`]));
  await applyBind(false);
  return 'conf';
}

// A config reload drops runtime rules: put ours back each time (caelestia reloads on every
// wallpaper or scheme change). Listens on the event socket, reconnects if Hyprland restarts it.
function keepWindowRules(className, onReload = () => {}) {
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
      if (lines.some((l) => l.startsWith('configreloaded>>'))) {
        applyWindowRules(className);
        onReload();
      }
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
function startHyprlandWatch({ overlay, onUpdate, onPointer, isPressed = () => false }) {
  let stopped = false;
  let origin = { x: 0, y: 0, monitor: null };
  let lastSnap = '';
  let giveBackTo = null; // where the keyboard belongs: the last window you used on the screen you see
  let givingBack = false;
  let selfAddress = null;
  let passThrough = true; // what the rule starts with
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
    selfAddress = self?.address || null;
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
    const onScreen = clients
      .filter((c) => c.mapped && !c.hidden && !isSelf(c) && shown.has(c.workspace.id))
      .sort((a, b) => a.focusHistoryID - b.focusHistoryID);
    giveBackTo = onScreen[0]?.address || null;
    // The overlay must never keep the keyboard: Hyprland gives it the focus when you switch
    // workspaces with the pointer anywhere (she covers the whole screen), or when you click her.
    // Unless you're holding her right now, the keyboard goes back where it belongs.
    if (active && isSelf(active) && !isPressed() && !givingBack) {
      givingBack = true;
      giveBack().finally(() => { givingBack = false; });
    }
    // as far as she knows, focus never moved to herself
    const snap = { fg: active && isSelf(active) ? giveBackTo : active?.address || null, wins };
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

  // a focus dispatch warps the pointer to the middle of the window: not with no_warps, set only
  // for this one dispatch, then back to whatever you had
  async function giveBack() {
    const to = giveBackTo;
    if (!to) return;
    const warps = (await hyprctl(['getoption', 'cursor:no_warps'])).includes('true') ? 'true' : 'false';
    await hyprctl(['eval', 'hl.config({ cursor = { no_warps = true } }) '
      + `hl.dispatch(hl.dsp.focus({ window = "address:${to}" })) `
      + `hl.config({ cursor = { no_warps = ${warps} } })`]);
  }

  // the pointer goes through her (true), or she takes it (false)
  async function setPassThrough(on) {
    if (on === passThrough || !selfAddress) return;
    passThrough = on;
    await hyprctl(['dispatch', `hl.dsp.window.set_prop({ window = "address:${selfAddress}", prop = "no_focus", value = "${on ? 1 : 0}" })`]);
  }

  return {
    cursor: () => pointer,
    setPassThrough,
    // a config reload put the rule back: she's pass-through again
    ruleReset() {
      passThrough = true;
    },
    // the page (re)loaded and missed what was sent before: send it all again on the next tick
    resend() {
      lastSnap = '';
      lastPointer = '';
    },
    // give the keyboard back to the window you were on, once you let go of her
    async refocus() {
      try {
        const active = await request('j/activewindow');
        if (active?.pid === process.pid && active.title === 'Capri') await giveBack();
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
