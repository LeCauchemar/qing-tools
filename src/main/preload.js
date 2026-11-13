'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);
const on = (ch, fn) => {
  const handler = (_e, payload) => fn(payload);
  ipcRenderer.on(ch, handler);
  return () => ipcRenderer.removeListener(ch, handler);
};

contextBridge.exposeInMainWorld('island', {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },

  getState: () => invoke('state:get'),
  reportRect: (r) => ipcRenderer.send('island:rect', r),
  focusWindow: () => ipcRenderer.send('ui:focus'),

  onState: (fn) => on('state:update', fn),
  onPointer: (fn) => on('pointer:update', fn),
  onPointerMove: (fn) => on('pointer:move', fn),
  onCommand: (fn) => on('cmd', fn),

  notes: {
    add: (text) => invoke('notes:add', text),
    addImage: (payload) => invoke('notes:addImage', payload),
    image: (payload) => invoke('notes:image', payload),
    update: (id, text) => invoke('notes:update', { id, text }),
    remove: (id) => invoke('notes:remove', id),
    togglePin: (id) => invoke('notes:togglePin', id),
    clear: () => invoke('notes:clear')
  },

  todos: {
    add: (text) => invoke('todos:add', text),
    toggle: (id) => invoke('todos:toggle', id),
    remove: (id) => invoke('todos:remove', id),
    clearDone: () => invoke('todos:clearDone')
  },

  reminders: {
    add: (payload) => invoke('reminders:add', payload),
    remove: (id) => invoke('reminders:remove', id),
    done: (id) => invoke('reminders:done', id),
    snooze: (id, minutes) => invoke('reminders:snooze', id, minutes),
    onFire: (cb) => ipcRenderer.on('reminder:fire', (e, data) => cb(data))
  },

  countdowns: {
    setPayday: (day) => invoke('countdowns:setPayday', day),
    addAnniversary: (payload) => invoke('countdowns:addAnniversary', payload),
    removeAnniversary: (id) => invoke('countdowns:removeAnniversary', id)
  },

  pruneFiles: () => invoke('files:prune'),

  account: {
    status: () => invoke('account:status'),
    check: (username) => invoke('account:check', { username }),
    register: (payload) => invoke('account:register', payload),
    login: (payload) => invoke('account:login', payload),
    recover: (payload) => invoke('account:recover', payload),
    me: () => invoke('account:me'),
    revokeSession: (id) => invoke('account:revokeSession', { id }),
    logout: () => invoke('account:logout'),
    logoutAll: () => invoke('account:logoutAll'),
    remove: (payload) => invoke('account:remove', payload)
  },

  sticky: {
    open: (id) => invoke('sticky:open', id),
    unstuck: (id) => invoke('sticky:unstuck', id)
  },

  clips: {
    copy: (id) => invoke('clip:copy', id),
    remove: (id) => invoke('clip:remove', id),
    togglePin: (id) => invoke('clip:togglePin', id),
    clear: () => invoke('clip:clear'),
    writeText: (text, keep) => invoke('clip:writeText', text, !!keep),
    data: (id) => invoke('clip:data', id),
    readNow: () => invoke('clip:readNow')
  },

  files: {
    add: (paths) => invoke('files:add', paths),
    pick: () => invoke('files:pick'),
    remove: (id) => invoke('files:remove', id),
    clear: () => invoke('files:clear'),
    copy: (ids) => invoke('files:copy', ids),
    copyPath: (id) => invoke('files:copyPath', id),
    reveal: (id) => invoke('files:reveal', id),
    open: (id) => invoke('files:open', id),
    dragOut: (id) => invoke('files:dragOut', id),
    uploadCloud: (id) => invoke('files:uploadCloud', id),
    probe: () => invoke('files:probe'),
    search: (query, opts) => invoke('files:search', query, opts),
    readText: (p) => invoke('files:readText', p),
    // Everything 联动：'status' | 'ensure' | 'install'
    everything: (action) => invoke('files:everything', action)
  },

  mail: {
    save: (cfg) => invoke('mail:save', cfg),
    test: (cfg) => invoke('mail:test', cfg),
    remove: (id) => invoke('mail:remove', id),
    refresh: (accId) => invoke('mail:refresh', accId || ''),
    markRead: (key) => invoke('mail:markRead', key),
    detail: (key, force) => invoke('mail:detail', key, force),
    disconnect: (id) => invoke('mail:disconnect', id || ''),
    oauthStart: (clientId, accountId) => invoke('mail:oauthStart', clientId, accountId || ''),
    oauthPoll: () => invoke('mail:oauthPoll'),
    oauthCancel: () => invoke('mail:oauthCancel')
  },

  settings: {
    save: (patch) => invoke('settings:save', patch)
  },

  app: {
    openExternal: (url) => invoke('app:openExternal', url),
    openPath: (p) => invoke('app:openPath', p),
    notify: (o) => invoke('app:notify', o),
    mask: (on) => invoke('app:mask', on),
    dragHold: (on) => ipcRenderer.send('app:dragHold', on),
    copyImage: (url) => invoke('app:copyImage', url),
    fitHeight: (h) => invoke('app:fitHeight', h),
    metrics: () => invoke('app:metrics'),
    saveImage: (url, name) => invoke('app:saveImage', url, name),
    checkUpdate: () => invoke('app:checkUpdate'),    downloadUpdate: () => invoke('app:downloadUpdate'),
    cloud: () => invoke('app:cloud'),
    sysStat: () => invoke('sys:stat'),
    screenshot: () => invoke('app:screenshot'),
    grabSelection: () => invoke('app:grabSelection'),
    hide: () => ipcRenderer.send('app:hide'),
  show: () => ipcRenderer.send('app:show'),
    focus: () => ipcRenderer.send('app:focus'),
    quit: () => ipcRenderer.send('app:quit'),
    revealData: () => ipcRenderer.send('app:revealData'),
    capture: () => invoke('debug:capture'),
  probe: () => invoke('debug:probe')
  },

  /** 拖入文件时拿真实路径（Electron 45：webUtils 仅在渲染侧可用） */
  pathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        const p = webUtils.getPathForFile(file);
        if (p) return p;
      }
    } catch (_) {}
    return (file && file.path) || '';
  }
});
