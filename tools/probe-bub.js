(() => {
  const b = document.querySelector('.bub.mixed');
  if (!b) return JSON.stringify({ found: false, total: document.querySelectorAll('.bub').length });
  const img = b.querySelector('img.inl');
  const r = b.getBoundingClientRect();
  const cs = getComputedStyle(b);
  const ir = img ? img.getBoundingClientRect() : { width: 0 };
  return JSON.stringify({
    found: true, bw: Math.round(r.width), bh: Math.round(r.height),
    display: cs.display, ws: cs.whiteSpace, maxW: cs.maxWidth,
    imgW: Math.round(ir.width), imgDisplay: img ? getComputedStyle(img).display : '',
    msgsW: Math.round(document.getElementById('chatMsgs').getBoundingClientRect().width),
    msgW: Math.round(b.parentElement.getBoundingClientRect().width),
    text: b.textContent.slice(0, 24)
  });
})()
