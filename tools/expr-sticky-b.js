(async () => {
  const img = document.querySelector('.note img.pic');
  const before = innerWidth + 'x' + innerHeight;
  img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 900));
  const h = document.querySelector('.rz-br');
  const r = h.getBoundingClientRect();
  const mk = (type, x, y) => new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, pointerId: 1, pointerType: 'mouse' });
  h.dispatchEvent(mk('pointerdown', r.left + 8, r.top + 8));
  window.dispatchEvent(mk('pointermove', r.left + 128, r.top + 98));
  await new Promise(r => setTimeout(r, 400));
  window.dispatchEvent(mk('pointerup', r.left + 128, r.top + 98));
  await new Promise(r => setTimeout(r, 400));
  return JSON.stringify({ before, after: innerWidth + 'x' + innerHeight });
})()
