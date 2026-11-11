(async () => {
  const img = document.getElementById('img');
  const st = document.getElementById('stage');
  const z0 = document.getElementById('zoom').textContent;
  st.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: st.clientWidth / 2, clientY: st.clientHeight / 2, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 260));
  const z1 = document.getElementById('zoom').textContent;
  st.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: 80, clientY: 80, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 260));
  return JSON.stringify({ natural: img.naturalWidth + 'x' + img.naturalHeight, stage: st.clientWidth + 'x' + st.clientHeight, z0, z1, z2: document.getElementById('zoom').textContent, tf: img.style.transform });
})()
