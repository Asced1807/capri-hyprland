#!/usr/bin/env node
'use strict';

// Adds (or removes) the Capri plugin for opencode: a one-line stub in opencode's global plugin
// folder that loads integrations/opencode/capri.js from this clone. Nothing else is touched.
//
//   node scripts/install-opencode.js            install
//   node scripts/install-opencode.js --uninstall
//   node scripts/install-opencode.js --status

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MARK = 'capri-desktop opencode plugin';
const PLUGIN = path.resolve(__dirname, '..', 'integrations', 'opencode', 'capri.js');

function pluginFile() {
  const config = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(config, 'opencode', 'plugin', 'capri.js');
}

function isOurs(file) {
  try {
    return fs.readFileSync(file, 'utf8').includes(MARK);
  } catch {
    return false;
  }
}

function install() {
  const file = pluginFile();
  if (fs.existsSync(file) && !isOurs(file)) {
    throw new Error(`${file} exists and isn't Capri's. Nothing was changed.`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `// ${MARK}: remove with \`npm run opencode:uninstall\`\nexport { CapriPlugin } from ${JSON.stringify(PLUGIN)};\n`);
  return { file };
}

function uninstall() {
  const file = pluginFile();
  if (!isOurs(file)) return { file, removed: false };
  fs.unlinkSync(file);
  return { file, removed: true };
}

function status() {
  const file = pluginFile();
  return { file, installed: isOurs(file) };
}

module.exports = { install, uninstall, status };

if (require.main === module) {
  const arg = process.argv[2];
  try {
    if (arg === '--uninstall') {
      const r = uninstall();
      console.log(r.removed ? `Capri plugin removed from ${r.file}` : `No Capri plugin at ${r.file}`);
    } else if (arg === '--status') {
      const r = status();
      console.log(r.installed ? `Installed: ${r.file}` : `Not installed (${r.file})`);
    } else {
      const r = install();
      console.log(`Capri plugin installed: ${r.file}`);
      console.log('Start a new opencode session for it to take effect.');
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
