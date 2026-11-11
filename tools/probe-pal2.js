(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const type = async (q) => {
    el.palInput.value = q;
    el.palInput.dispatchEvent(new Event('input'));
    await wait(1200);
    return {
      q,
      groups: [...document.querySelectorAll('#palList .pal-group')].map((g) => g.textContent.trim()),
      items: [...document.querySelectorAll('#palList .pal-item')].slice(0, 4).map((b) => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 70)),
      total: S.palItems.length,
    };
  };
  openPalette();
  await wait(150);
  const out = { empty: await type(''), note: await type('野人'), mail: await type('邮箱'), cmd: await type('计') };
  // 选中态跟着分组走
  out.sel = S.palSel;
  closePalette();
  return out;
})()