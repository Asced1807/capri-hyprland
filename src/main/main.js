'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, protocol, net, shell, globalShortcut, nativeImage,
} = require('electron');

const config = require('./config');
const { createBridge } = require('./bridge');
const { startWindowWatch } = require('./windows');
const { isHyprland, applyWindowRules, keepWindowRules, startHyprlandWatch } = require('./hyprland');
const hooks = require('../../scripts/install-hooks');
const demoSteps = require('../../scripts/demo-sequence');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = process.argv.includes('--dev');
const HYPR = isHyprland();
// the Wayland app id, what the Hyprland window rule matches
const APP_CLASS = 'capri-desktop';
// put her away / bring her back. Ctrl+Alt+C is caelestia's "clear notifications" on Hyprland,
// and Electron's global shortcuts don't reach Wayland anyway: the compositor binds this one.
const SHORTCUT = HYPR ? 'Super+Alt+C' : 'Ctrl+Alt+C';
const PORT = Number(process.env.CAPRI_PORT) || 47823;
const SOUND_EXT = /\.(mp3|wav|ogg|m4a)$/i;

protocol.registerSchemesAsPrivileged([
  { scheme: 'capri', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let overlay = null;
let tray = null;
let demoTimer = null;
let windowWatch = null;
let ruleKeeper = null;
let quitting = false;
let pressed = false; // a button held down on her (Hyprland: she may keep the focus meanwhile)

const userSoundsDir = () => path.join(app.getPath('userData'), 'sounds');

// capri://app/...        -> files of this repo
// capri://usersounds/... -> the user's own sound overrides
function serveProtocol() {
  protocol.handle('capri', (request) => {
    const url = new URL(request.url);
    const base = url.host === 'usersounds' ? userSoundsDir() : ROOT;
    const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (target !== base && !target.startsWith(base + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function targetDisplay() {
  const { displayId } = config.load();
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

// On Hyprland the overlay covers the whole monitor (the window rule sizes it): Electron doesn't
// know about the bar's reserved space on Wayland anyway.
function overlayArea() {
  const display = targetDisplay();
  return HYPR ? display.bounds : display.workArea;
}

function fitOverlay() {
  if (!overlay) return;
  const workArea = overlayArea();
  overlay.setBounds(workArea);
  overlay.webContents.send('overlay:resize', { width: workArea.width, height: workArea.height });
}

function createOverlay() {
  const workArea = overlayArea();
  overlay = new BrowserWindow({
    ...workArea,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadURL('capri://app/src/renderer/index.html');
  // always shown: put away, she's still there as her biochip in the corner
  overlay.once('ready-to-show', () => overlay.showInactive());
  // A "close window" shortcut that reached her anyway: she stays, unless you quit from the tray.
  overlay.on('close', (e) => {
    if (!quitting) e.preventDefault();
  });
  // updates are only sent when something changes: a page that loads after the first one would
  // never hear about windows that stay put
  overlay.webContents.on('did-finish-load', () => windowWatch?.resend?.());
  overlay.webContents.on('render-process-gone', (_e, details) => {
    console.error('[capri] renderer gone:', details.reason);
  });
  if (DEV) {
    overlay.webContents.on('console-message', (e) => {
      const { level, message, lineNumber, sourceId } = e;
      console.log(`[renderer:${level}] ${message} (${String(sourceId).split('/').pop()}:${lineNumber})`);
    });
    if (process.env.CAPRI_DEVTOOLS) overlay.webContents.openDevTools({ mode: 'detach' });
  }
}

function sendCommand(name, payload = {}) {
  overlay?.webContents.send('capri:command', { name, ...payload });
}

// Ctrl+Alt+C: she folds herself away into her biochip in the corner, or comes back out of it.
function toggleVisible(force) {
  const visible = typeof force === 'boolean' ? force : !config.load().visible;
  config.save({ visible });
  sendCommand('stow', { on: !visible });
  rebuildTray();
}

function playDemo() {
  clearTimeout(demoTimer);
  let i = 0;
  const next = () => {
    if (i >= demoSteps.length) return;
    const [delay, evt] = demoSteps[i++];
    demoTimer = setTimeout(() => {
      overlay?.webContents.send('claude:event', evt);
      next();
    }, delay);
  };
  next();
}

// During the demo, a little fake terminal for her to sit on and take over (window tracking is
// Windows only, so only there). Opened without stealing focus; closing it drops her off it.
let demoWin = null;
const DEMO_TERMINAL = `<body style="margin:0;background:#14101c;color:#8f8aa3;font:13px/1.7 Consolas,monospace;padding:14px 18px">
<div style="color:#36ff7a">PS C:\\night-city-api&gt; npm test -- gigs</div>
<div>&nbsp;&nbsp;GET /gigs</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ returns 20 items per page</div>
<div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ paginates with a cursor</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ rejects a bad cursor</div>
<div>&nbsp;&nbsp;6 passing (212ms)</div><div style="color:#36ff7a">PS C:\\night-city-api&gt; _</div></body>`;

function demoWindow(open) {
  demoWin?.destroy();
  demoWin = null;
  if (!open || (process.platform !== 'win32' && !HYPR)) return false;
  const b = overlay.getBounds();
  demoWin = new BrowserWindow({
    x: Math.round(b.x + b.width * 0.5 - 310), y: Math.round(b.y + b.height * 0.42), width: 620, height: 300,
    show: false, alwaysOnTop: true, title: 'night-city-api — npm test', backgroundColor: '#14101c', autoHideMenuBar: true,
  });
  demoWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(DEMO_TERMINAL)}`);
  demoWin.once('ready-to-show', () => demoWin?.showInactive());
  demoWin.on('closed', () => { demoWin = null; });
  return true;
}

const LANGS = ['fr', 'en', 'es'];

// 'auto' -> the first system language Capri speaks, English otherwise.
function resolveLang(setting) {
  if (LANGS.includes(setting)) return setting;
  const preferred = [...app.getPreferredSystemLanguages(), app.getSystemLocale(), app.getLocale()];
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

// Your system user name, "asce" -> "Asce"
function systemUserName() {
  let user = '';
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USER || process.env.USERNAME || '';
  }
  return user ? user[0].toUpperCase() + user.slice(1) : '';
}

// What the overlay gets: `lang` is the resolved one, `langSetting` what the user picked,
// `userName` what she calls you.
function rendererConfig() {
  const cfg = config.load();
  const userName = (cfg.name || '').trim() || systemUserName();
  return { ...cfg, lang: resolveLang(cfg.lang), langSetting: cfg.lang, userName, shortcut: SHORTCUT };
}

// A small window to type the name she calls you (tray menus can't take text).
let nameWin = null;
function askName(t) {
  if (nameWin) return nameWin.focus();
  const current = (config.load().name || '').trim();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Capri · ${t.name}</title></head>
<body style="margin:0;background:#14101c;color:#e9e4f5;font:14px system-ui,sans-serif;padding:18px">
<form id="f"><label for="n">${t.nameAsk}</label>
<input id="n" maxlength="40" placeholder="${systemUserName()}" style="display:block;width:100%;box-sizing:border-box;margin:10px 0;padding:8px;background:#1f1a2b;color:#fff;border:1px solid #6b3fd4;border-radius:4px;font:inherit">
<button style="padding:6px 16px;background:#ff2b4f;color:#fff;border:0;border-radius:4px;font:inherit;cursor:pointer">${t.nameSave}</button></form>
<script>
const n = document.getElementById('n');
n.value = ${JSON.stringify(current).replace(/</g, '\\u003c')};
n.focus();
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  await window.host.setConfig({ name: n.value.trim() });
  window.close();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });
</script></body></html>`;
  nameWin = new BrowserWindow({
    width: 380, height: 170, resizable: false, minimizable: false, maximizable: false, autoHideMenuBar: true,
    backgroundColor: '#14101c', title: `Capri · ${t.name}`,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: true },
  });
  nameWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  nameWin.on('closed', () => { nameWin = null; });
}

function updateConfig(patch) {
  config.save(patch);
  const cfg = rendererConfig();
  overlay?.webContents.send('capri:config', cfg);
  rebuildTray();
  return cfg;
}

function rebuildTray() {
  if (!tray) return;
  const cfg = config.load();
  const hookState = hooks.status();
  const lang = resolveLang(cfg.lang);
  const t = lang === 'es'
    ? {
      online: `Capri — escuchando en ${PORT}`, teleport: 'Teletransportar', satellite: 'Mirar el satélite', demo: 'Ver la demo', show: 'Traerla de vuelta', hide: 'Guardarla',
      size: 'Tamaño', small: 'Pequeña', medium: 'Mediana', large: 'Grande', sound: 'Sonido', mute: 'Silenciar',
      soundsDir: 'Abrir carpeta de sonidos propios', screen: 'Pantalla', wander: 'Pasearse sola', possess: 'Poseer ventanas sola',
      lang: 'Idioma', auto: 'Automático (sistema)', startup: 'Arrancar con el sistema', hooksOn: 'Hooks de Claude Code: instalados',
      hooksOff: 'Instalar hooks de Claude Code', hooksRemove: 'Quitar hooks de Claude Code', quit: 'Salir',
      possessNow: 'Poseer una ventana', lively: 'Más animada', name: 'Cómo me llamas', nameUser: 'Mi usuario', nameOther: 'Otro nombre…', nameAsk: '¿Cómo quieres que te llame?', nameSave: 'Guardar',
    }
    : lang === 'en'
    ? {
      online: `Capri — listening on ${PORT}`, teleport: 'Teleport', satellite: 'Look at the satellite', demo: 'Play demo', show: 'Bring her back', hide: 'Put her away',
      size: 'Size', small: 'Small', medium: 'Medium', large: 'Large', sound: 'Sound', mute: 'Mute',
      soundsDir: 'Open custom sounds folder', screen: 'Screen', wander: 'Wander around when idle', possess: 'Possess my windows',
      lang: 'Language', auto: 'Automatic (system)', startup: 'Start with Windows', hooksOn: 'Claude Code hooks: installed',
      hooksOff: 'Install Claude Code hooks', hooksRemove: 'Remove Claude Code hooks', quit: 'Quit',
      possessNow: 'Possess a window', lively: 'Livelier', name: 'What she calls you', nameUser: 'My user name', nameOther: 'Another name…', nameAsk: 'What should she call you?', nameSave: 'Save',
    }
    : {
      online: `Capri — à l'écoute sur ${PORT}`, teleport: 'Téléporter', satellite: 'Regarder le satellite', demo: 'Lancer la démo', show: 'La faire revenir', hide: 'La ranger',
      size: 'Taille', small: 'Petite', medium: 'Moyenne', large: 'Grande', sound: 'Son', mute: 'Muet',
      soundsDir: 'Ouvrir le dossier des sons perso', screen: 'Écran', wander: 'Se balader quand rien ne se passe', possess: 'Posséder mes fenêtres',
      lang: 'Langue', auto: 'Automatique (système)', startup: 'Lancer au démarrage', hooksOn: 'Hooks Claude Code : installés',
      hooksOff: 'Installer les hooks Claude Code', hooksRemove: 'Retirer les hooks Claude Code', quit: 'Quitter',
      possessNow: 'Posséder une fenêtre', lively: 'Plus animée', name: 'Comment elle t’appelle', nameUser: 'Mon nom d’utilisateur', nameOther: 'Un autre nom…', nameAsk: 'Comment veux-tu qu’elle t’appelle ?', nameSave: 'Enregistrer',
    };

  // Linux trays (caelestia's among them) often don't draw checkmarks: say the state in the label
  const yes = lang === 'es' ? 'sí' : lang === 'fr' ? 'oui' : 'on';
  const no = lang === 'es' ? 'no' : lang === 'fr' ? 'non' : 'off';
  const state = (label, on) => (process.platform === 'linux' ? `${label}: ${on ? yes : no}` : label);

  const displays = screen.getAllDisplays();
  const current = targetDisplay().id;

  const menu = Menu.buildFromTemplate([
    { label: t.online, enabled: false },
    { type: 'separator' },
    { label: t.teleport, click: () => sendCommand('teleport') },
    { label: t.satellite, click: () => sendCommand('satellite') },
    { label: t.possessNow, click: () => sendCommand('possess') },
    { label: t.demo, click: playDemo },
    { label: cfg.visible ? t.hide : t.show, accelerator: SHORTCUT, click: () => toggleVisible() },
    { type: 'separator' },
    {
      label: t.size,
      submenu: [[t.small, 0.45], [t.medium, 0.6], [t.large, 0.8]].map(([label, scale]) => ({
        label, type: 'radio', checked: Math.abs(cfg.scale - scale) < 0.01, click: () => updateConfig({ scale }),
      })),
    },
    {
      label: t.sound,
      submenu: [
        { label: state(t.mute, cfg.muted), type: 'checkbox', checked: cfg.muted, click: (item) => updateConfig({ muted: item.checked }) },
        { type: 'separator' },
        {
          label: t.soundsDir,
          click: () => {
            fs.mkdirSync(userSoundsDir(), { recursive: true });
            shell.openPath(userSoundsDir());
          },
        },
      ],
    },
    {
      label: t.screen,
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `${i + 1} — ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === current,
        click: () => { config.save({ displayId: d.id }); fitOverlay(); rebuildTray(); },
      })),
    },
    { label: state(t.wander, cfg.wander), type: 'checkbox', checked: cfg.wander, click: (item) => updateConfig({ wander: item.checked }) },
    { label: state(t.possess, cfg.possess), type: 'checkbox', checked: cfg.possess, click: (item) => updateConfig({ possess: item.checked }) },
    { label: state(t.lively, cfg.lively), type: 'checkbox', checked: cfg.lively, click: (item) => updateConfig({ lively: item.checked }) },
    {
      label: t.name,
      submenu: [
        { label: `${t.nameUser} (${systemUserName()})`, type: 'radio', checked: !(cfg.name || '').trim(), click: () => updateConfig({ name: '' }) },
        ...((cfg.name || '').trim() ? [{ label: cfg.name.trim(), type: 'radio', checked: true }] : []),
        { type: 'separator' },
        { label: t.nameOther, click: () => askName(t) },
      ],
    },
    {
      label: t.lang,
      submenu: [[t.auto, 'auto'], ['Español', 'es'], ['Français', 'fr'], ['English', 'en']].map(([label, lang]) => ({
        label, type: 'radio', checked: cfg.lang === lang, click: () => updateConfig({ lang }),
      })),
    },
    process.platform === 'linux' ? null : {
      label: t.startup,
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    { type: 'separator' },
    hookState.installed
      ? { label: t.hooksOn, enabled: false }
      : { label: t.hooksOff, click: () => runHooks('install') },
    ...(hookState.installed ? [{ label: t.hooksRemove, click: () => runHooks('uninstall') }] : []),
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() },
  ].filter(Boolean));
  tray.setContextMenu(menu);
}

// Run from a clone (`npm start`), electron.exe alone would open the default Electron app at login:
// it needs the project folder as argument.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [ROOT] };
}

function runHooks(action) {
  try {
    const result = action === 'install' ? hooks.install() : hooks.uninstall();
    sendCommand('hooks', { action, ok: true, file: result.file });
  } catch (err) {
    sendCommand('hooks', { action, ok: false, error: err.message });
  }
  rebuildTray();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ROOT, 'assets', 'icons', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Capri');
  tray.on('click', () => sendCommand('status'));
  rebuildTray();
}

function registerIpc() {
  // On Hyprland a click on her gives the overlay the keyboard. Not taken back on the press:
  // Hyprland would move the pointer away with it and the drag would never see its release.
  ipcMain.on('overlay:pressed', () => {
    pressed = true;
  });
  ipcMain.on('overlay:released', () => {
    pressed = false;
    if (HYPR) windowWatch?.refocus();
  });
  ipcMain.on('overlay:interactive', (_e, on) => {
    overlay?.setIgnoreMouseEvents(!on, { forward: true });
    if (HYPR) {
      windowWatch?.setPassThrough(!on); // what actually lets the pointer through on Wayland
      if (!on) windowWatch?.refocus();
    }
  });
  ipcMain.handle('overlay:cursor', () => {
    if (HYPR) return windowWatch.cursor();
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    return { x: p.x - b.x, y: p.y - b.y, inside: p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height };
  });
  ipcMain.handle('config:get', () => rendererConfig());
  ipcMain.handle('hooks:status', () => hooks.status());
  ipcMain.handle('config:set', (_e, patch) => updateConfig(patch));
  ipcMain.handle('demo:window', (_e, open) => demoWindow(open));
  ipcMain.handle('sounds:list', () => {
    try {
      return fs.readdirSync(userSoundsDir())
        .filter((f) => SOUND_EXT.test(f))
        .map((f) => ({ name: f.replace(SOUND_EXT, '').toLowerCase(), url: `capri://usersounds/${encodeURIComponent(f)}` }));
    } catch {
      return [];
    }
  });
}

// Only in --dev: lets scripts drive the overlay and grab frames of it (no desktop content, just our window).
const testWins = new Map(); // name -> test window

async function debugHandler(route, body) {
  if (!DEV) throw new Error('debug routes need --dev');
  if (route === 'command') {
    sendCommand(body.name, body);
    return { ok: true };
  }
  if (route === 'reload') {
    overlay.webContents.reloadIgnoringCache();
    return { ok: true };
  }
  if (route === 'testwin') {
    // plain windows to sit on, opened without stealing focus, by name (`id`, default "main");
    // each one opened goes in front of the others. { open: false } without an id closes them all.
    const id = body.id ?? 'main';
    if (!body.open && body.id === undefined) {
      for (const win of testWins.values()) win.destroy();
      testWins.clear();
      return { ok: true };
    }
    testWins.get(id)?.destroy();
    testWins.delete(id);
    if (body.open) {
      const b = overlay.getBounds();
      const win = new BrowserWindow({
        x: b.x + (body.x ?? 300), y: b.y + (body.y ?? 380), width: body.w ?? 720, height: body.h ?? 380,
        show: false, alwaysOnTop: true, title: `Capri test window ${id}`, backgroundColor: '#1b1726',
      });
      win.loadURL('data:text/html,<body style="background:%231b1726"></body>');
      win.showInactive();
      testWins.set(id, win);
    }
    return { ok: true };
  }
  if (route === 'movewin' && testWins.has(body.id ?? 'main')) {
    const win = testWins.get(body.id ?? 'main');
    const [x, y] = win.getPosition();
    win.setPosition(x + (body.dx || 0), y + (body.dy || 0));
    return { ok: true };
  }
  if (route === 'mouse') {
    // the pointer moving over the overlay (css px), and clicking if asked, without touching the real one
    const at = { x: Math.round(body.x), y: Math.round(body.y) };
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...at });
    if (body.click) {
      overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...at });
      overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...at });
    }
    return { ok: true };
  }
  if (route === 'capture') {
    const image = await overlay.webContents.capturePage();
    // installed, the app's own folder is read-only: its data folder instead
    const dir = path.join(app.isPackaged ? app.getPath('userData') : ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${(body.name || 'frame').replace(/[^\w-]/g, '')}.png`);
    fs.writeFileSync(file, image.toPNG());
    return { ok: true, file };
  }
  throw new Error('unknown debug route');
}

function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => sendCommand('status'));
  if (process.platform === 'win32') app.setAppUserModelId('capri.desktop');

  app.whenReady().then(async () => {
    serveProtocol();
    registerIpc();
    if (HYPR) {
      await applyWindowRules(APP_CLASS);
      ruleKeeper = keepWindowRules(APP_CLASS, () => windowWatch?.ruleReset?.());
    }
    createOverlay();
    createTray();
    const onUpdate = (data) => overlay?.webContents.send('windows:update', data);
    windowWatch = HYPR
      ? startHyprlandWatch({
        overlay, onUpdate, onPointer: (p) => overlay?.webContents.send('overlay:pointer', p), isPressed: () => pressed,
      })
      : startWindowWatch({ overlay, onUpdate });
    createBridge({
      port: PORT,
      onEvent: (evt) => overlay?.webContents.send('claude:event', evt),
      onToggle: () => toggleVisible(),
      onDebug: DEV ? debugHandler : null,
    });
    if (!HYPR) globalShortcut.register('Control+Alt+C', () => toggleVisible());
    screen.on('display-metrics-changed', fitOverlay);
    screen.on('display-added', () => { fitOverlay(); rebuildTray(); });
    screen.on('display-removed', () => { fitOverlay(); rebuildTray(); });
  });

  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    windowWatch?.stop();
    ruleKeeper?.stop();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}

main();
