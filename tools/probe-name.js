JSON.stringify({
  title: document.title,
  brand: (document.querySelector('.brand-name') || {}).textContent,
  appVer: (document.querySelector('#appVersion') || {}).textContent,
  heads: [...document.querySelectorAll('.tc-title')].map((x) => x.textContent),
  settingsRows: [...document.querySelectorAll('.pane[data-pane="settings"] .setting b')].map((x) => x.textContent),
})