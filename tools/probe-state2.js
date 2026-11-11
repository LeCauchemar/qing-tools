JSON.stringify({
  weatherCity: (S.data.settings || {}).weatherCity,
  toolsOpen: (S.data.settings || {}).toolsOpen,
  paletteHidden: document.querySelector('#palette').classList.contains('hidden'),
  mode: S.mode,
  pinned: S.pinned,
  paletteStyle: (() => {
    const p = document.querySelector('#palette');
    const c = getComputedStyle(p);
    return { background: c.backgroundColor, backdrop: c.backdropFilter, inset: c.inset, display: c.display, opacity: c.opacity };
  })(),
  wx: S.wx,
  idleSub: document.querySelector('#idleSub').textContent,
})