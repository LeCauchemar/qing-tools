import fs from 'node:fs';

const p = 'D:/deepseek harness daily/AGENTS.md';
let t = fs.readFileSync(p, 'utf8');
const add = [
  '',
  '  - **1.10.4（编辑框右键菜单 + 粘贴不跳条）**：',
  '      - 编辑框右键菜单 `#editMenu`（剪切/复制/粘贴/粘贴图片/全选）挂在 `#stage` 直属，按钮用 `data-act="edit-*"`；菜单项**不要**各自绑 click —— `document` 上已有一层全局 `[data-act]` 委托，重复绑会让粘贴执行两次（`#noteMenu` 也踩过同样的坑，已改成只靠全局委托）。',
  '      - `.note-rich` 的 contextmenu 里要先 `closeNoteMenu()` 再 `openEditMenu()`：`#noteList` 上原有的行右键监听会同时开 `#noteMenu`，两个菜单会叠在一起。',
  '      - `flushLiveNote()` + `renderNotes()` 开头先落盘再重绘，否则 800ms 防抖还没到就重绘，刚打的字被旧数据覆盖（表现为「粘贴后我写的字没了」）。',
  '      - `noteSort(list)` 在编辑中把当前条目钉回原位置（记住 `S.noteOrder`），不然自动保存刷新 `updatedAt` 会让它跳到列表顶部、看着像图片跑到别条去了。',
  '      - `pasteFromClipboard(imageOnly)` 定义在 `bindUi()` 里（要用闭包里的 `insertRichImageData`），通过 `S.notePaste` 暴露给 `handleAct`。',
  '',
  '  - **血的教训（1.10.3）**：测试脚本清理数据时**只删自己刚创建的那几条**（按文本前缀 / 创建时间判断）。`for (const n of S.data.notes) await api.notes.remove(n.id)` 已经把用户真实的三条备忘录删掉了，且没有备份可恢复 —— 今后任何 `remove`/`clear` 循环都必须先过滤。',
  '',
].join('\n');

if (!t.includes('1.10.4（编辑框右键菜单')) {
  t = t.replace(/\s+$/, '\n') + add;
  fs.writeFileSync(p, t);
  console.log('appended', t.length);
} else {
  console.log('already there');
}
