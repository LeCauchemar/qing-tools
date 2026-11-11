(() => {
  const isl = document.getElementById('island');
  const r = isl.getBoundingClientRect();
  const vp = document.querySelector('.view-panel');
  const pane = document.querySelector('[data-pane="tools"]');
  const cs = getComputedStyle(vp);
  const cp = getComputedStyle(pane);
  return JSON.stringify({
    mode: S.mode, tab: S.tab, theme: document.documentElement.dataset.theme,
    isl: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    stage: document.getElementById('stage').dataset.state,
    view: { op: cs.opacity, vis: cs.visibility, disp: cs.display, t: cs.transform },
    pane: { op: cp.opacity, vis: cp.visibility, disp: cp.display, h: Math.round(pane.getBoundingClientRect().height) },
    bodyBg: getComputedStyle(document.body).backgroundColor
  });
})()
