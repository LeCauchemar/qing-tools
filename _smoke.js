const fs = require('fs');
const out = [];
const log = (...a) => out.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
const e = require('electron');
const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, shell, dialog, nativeImage, screen } = e;
app.whenReady().then(async () => {
  log('module exports', Object.keys(e).sort());
  log('app fns', ['setLoginItemSettings','getLoginItemSettings','setAppUserModelId','getPath','requestSingleInstanceLock','relaunch','setBadgeCount'].map(k => k + ':' + typeof app[k]));
  log('nativeImage', ['createFromPath','createFromDataURL','createFromBuffer','createEmpty'].map(k => k + ':' + typeof nativeImage[k]));
  const w = new BrowserWindow({ width: 200, height: 120, show: false, frame: false, transparent: true, webPreferences: { sandbox: false, contextIsolation: true } });
  log('win fns', ['setSkipTaskbar','setVisibleOnAllWorkspaces','setIgnoreMouseEvents','setAlwaysOnTop','setBounds','setPosition','showInactive','moveTop','setFocusable','setResizable','hide','destroy'].map(k => k + ':' + typeof w[k]));
  log('wc fns', ['startDrag','capturePage','executeJavaScript','setZoomFactor','openDevTools'].map(k => k + ':' + typeof w.webContents[k]));
  log('Tray', typeof Tray, 'Notification', typeof Notification, 'Menu', typeof Menu, 'globalShortcut', typeof globalShortcut);
  log('shell', ['openExternal','openPath','showItemInFolder','trashItem'].map(k => k + ':' + typeof shell[k]));
  log('dialog.showOpenDialog', typeof dialog.showOpenDialog);
  log('globalShortcut fns', ['register','unregisterAll'].map(k => k + ':' + typeof globalShortcut[k]));
  try {
    const t = await require('electron').clipboard.readText();
    log('clipboard.readText ->', JSON.stringify(t));
    const items = await require('electron').clipboard.read();
    log('clipboard.read ->', items.length, items.map(i => i.types));
  } catch (err) { log('clipboard err', err.message); }
  log('loginItem', JSON.stringify(app.getLoginItemSettings()));
  log('paths userData', app.getPath('userData'));
  fs.writeFileSync('_smoke.log', out.join('\n'), 'utf8');
  setTimeout(() => app.quit(), 200);
});
