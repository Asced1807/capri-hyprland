'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const listener = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('host', {
  onClaudeEvent: on('claude:event'),
  onCommand: on('capri:command'),
  onConfig: on('capri:config'),
  onResize: on('overlay:resize'),
  onWindows: on('windows:update'),
  onPointer: on('overlay:pointer'),
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', Boolean(on)),
  released: () => ipcRenderer.send('overlay:released'),
  cursor: () => ipcRenderer.invoke('overlay:cursor'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  listSounds: () => ipcRenderer.invoke('sounds:list'),
  hooksStatus: () => ipcRenderer.invoke('hooks:status'),
  demoWindow: (open) => ipcRenderer.invoke('demo:window', Boolean(open)),
});
