(async () => {
  const inp = document.querySelector('#noteInput');
  inp.value = 'MENU-T1 菜单粘贴';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 240 });
  inp.dispatchEvent(ev);
  await new Promise((r) => setTimeout(r, 200));
  const menu = document.querySelector('#editMenu');
  const target = S.editTarget;
  const btn = menu && menu.querySelector('[data-act="edit-paste-img"]');
  if (btn) btn.click();
  await new Promise((r) => setTimeout(r, 1600));
  return JSON.stringify({
    target,
    menuShown: menu ? !menu.classList.contains('hidden') : null,
    inputLeft: inp.value,
    notes: (S.data.notes || []).map((n) => ({ id: n.id, text: (n.text || '').slice(0, 80) })),
  });
})()
