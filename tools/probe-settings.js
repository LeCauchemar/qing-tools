(() => {
  const pane = document.querySelector('[data-pane="settings"]');
  const ids = ['themeSeg', 'accentCustom', 'updateCheck', 'updateInstall', 'updateVer', 'msOauthBox', 'islandRecenter'];
  const out = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    out[id] = el ? { exists: true, vis: getComputedStyle(el).visibility, disp: getComputedStyle(el).display, parentHidden: el.closest('.hidden') ? true : false } : { exists: false };
  });
  out._text = pane ? pane.innerText.replace(/\s+/g, ' ').slice(0, 600) : 'no pane';
  out._err = window.__lastErr || '';
  return JSON.stringify(out);
})()
