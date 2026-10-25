'use strict';

// Starts Capri when an agent (Claude Code, opencode) starts and she isn't running yet.
// Only from a clone (`npm install` puts Electron in node_modules); the installed Windows app
// starts with Windows instead. CAPRI_AUTOSTART=0 turns it off.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function electronBinary() {
  const dist = path.join(ROOT, 'node_modules', 'electron', 'dist');
  if (process.platform === 'win32') return path.join(dist, 'electron.exe');
  if (process.platform === 'darwin') return path.join(dist, 'Electron.app', 'Contents', 'MacOS', 'Electron');
  return path.join(dist, 'electron');
}

function launch() {
  if (process.env.CAPRI_AUTOSTART === '0') return false;
  const bin = electronBinary();
  if (!fs.existsSync(bin)) return false;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // set when the hook itself runs on Capri's Electron
  // her own session: she outlives the terminal and the agent that started her
  spawn(bin, [ROOT], { detached: true, stdio: 'ignore', env, windowsHide: false }).unref();
  return true;
}

module.exports = { launch };
