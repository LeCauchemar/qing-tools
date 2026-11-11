(() => {
  const tabs = [...document.querySelectorAll('.tab')];
  const t = tabs[5];
  const cs = getComputedStyle(t);
  return JSON.stringify({
    n: tabs.length,
    aria: t.getAttribute('aria-selected'),
    matchesSel: t.matches('.tab[aria-selected="true"]'),
    color: cs.color,
    ink: cs.getPropertyValue('--ink').trim(),
    muted: cs.getPropertyValue('--muted').trim(),
    theme: document.documentElement.dataset.theme
  });
})()
