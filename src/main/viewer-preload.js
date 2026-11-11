'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('viewer', {
  close: () => ipcRenderer.send('viewer:close')
});
