'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const params = new URLSearchParams(location.search);
const id = params.get('id') || '';

contextBridge.exposeInMainWorld('sticky', {
  id,
  snapshot: () => ipcRenderer.invoke('sticky:snapshot', id),
  update: (text) => ipcRenderer.invoke('sticky:update', id, text),
  font: (size) => ipcRenderer.invoke('sticky:font', id, size),
  unstuck: () => ipcRenderer.invoke('sticky:unstuck', id),
  remove: () => ipcRenderer.invoke('sticky:remove', id),
  view: (file) => ipcRenderer.invoke('sticky:view', file),
  resize: (w, h) => ipcRenderer.send('sticky:resize', id, w, h),
  onUpdate: (cb) => ipcRenderer.on('sticky:update', (e, note) => cb(note))
});
