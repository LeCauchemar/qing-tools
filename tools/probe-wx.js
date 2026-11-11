JSON.stringify({
  wx: S.wx,
  wxSub: document.querySelector('#wxSub').textContent,
  idleSub: document.querySelector('#idleSub').textContent,
  pal: (() => {
    openPalette();
    el.palInput.value = 'package';
    el.palInput.dispatchEvent(new Event('input'));
    return [...document.querySelectorAll('#palList .pal-group')].map((g) => g.textContent.trim());
  })(),
  palItems: S.palItems.length,
})