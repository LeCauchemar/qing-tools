(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  openPalette();
  await wait(120);

  const type = async (q) => {
    el.palInput.value = q;
    el.palInput.dispatchEvent(new Event('input'));
    await wait(1300);
    return {
      q,
      groups: [...document.querySelectorAll('#palList .pal-group')].map((g) => g.textContent.trim()),
      items: [...document.querySelectorAll('#palList .pal-item')].slice(0, 6).map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      total: S.palItems.length,
    };
  };

  out.package = await type('package');
  out.pkg0 = S.palItems[0] ? { kind: S.palItems[0].kind, id: S.palItems[0].id } : null;

  out.note = await type('测试');
  out.mail = await type('验证');
  out.empty = await type('zzzzzzzz');
  closePalette();
  return out;
})()