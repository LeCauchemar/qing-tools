(async () => {
  const txt = await (await fetch('styles.css', { cache: 'no-store' })).text();
  const i = txt.indexOf('.tab[aria-selected="true"]');
  const seg = txt.slice(i, i + 90).replace(/\s+/g, ' ');
  const rules = [...document.styleSheets[0].cssRules].filter(r => r.selectorText && r.selectorText.includes('.tab')).map(r => r.selectorText + ' {' + r.style.cssText + '}');
  return JSON.stringify({ len: txt.length, seg, rules });
})()
