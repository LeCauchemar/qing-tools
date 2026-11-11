(async () => {
  const box = document.getElementById('fsResults');
  const rows = Array.from(box.querySelectorAll('.fs-row'));
  if (rows.length < 2) return 'no rows';
  // 1) 点复选
  rows[0].querySelector('.fs-check').click();
  const afterCheck = S.fs.sel.size;
  // 2) 划框多选（模拟 mousedown 在空白 + 移动覆盖前两行）
  const empty = box.querySelector('.fs-hint') || box.querySelector('.fs-head');
  const er = empty.getBoundingClientRect();
  box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: er.left + 8, clientY: er.top + 2, button: 0 }));
  const r1 = rows[1].getBoundingClientRect();
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r1.right - 6, clientY: r1.bottom - 4 }));
  const midSel = S.fs.sel.size;
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  const afterMarquee = S.fs.sel.size;
  // 3) 右键菜单
  rows[2].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r1.left + 40, clientY: r1.top + 6 }));
  const menuShown = !document.getElementById('fsMenu').classList.contains('hidden');
  return JSON.stringify({ afterCheck, midSel, afterMarquee, menuShown, sel: Array.from(S.fs.sel).map(p=>p.split('\\').pop()) });
})()
