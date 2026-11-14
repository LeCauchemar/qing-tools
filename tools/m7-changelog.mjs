import fs from "node:fs";
const p = "site/changelog.html";
let s = fs.readFileSync(p, "utf8");
const re = /<article class="cl-item[^"]*">[\s\S]*?<\/article>/g;
const blocks = s.match(re) || [];
if (!blocks.length) { console.error("no blocks"); process.exit(2); }
const key = (b) => {
  const m = b.match(/cl-side"><b>([^<]+)<\/b>/);
  if (!m) return 0;
  const v = m[1].match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!v) return 0;
  return Number(v[1]) * 1e6 + Number(v[2]) * 1e3 + Number(v[3] || 0);
};
const label = (b) => (b.match(/cl-side"><b>([^<]+)<\/b>/) || [,""])[1];
const seen = new Map();
for (const b of blocks) {
  const k = label(b);
  const prev = seen.get(k);
  if (!prev || b.length > prev.length) seen.set(k, b);
}
const items = [...seen.values()].sort((a, b) => key(a) - key(b));

const entry = `  <article class="cl-item v5">
      <div class="cl-side"><b>1.15.0</b><span>11-14</span></div>
      <div class="cl-body">
        <h3>待办的圈细回去了，清空不再误删，小纸条里能看见好友</h3>
        <ul>
          <li>待办前面那个勾改回细圈：17px、1.2px 描边，完成时只是圈和勾变成强调色 —— 不再是点击后冒出一大块紫色方块。</li>
          <li>「全部删除」现在保留两类：钉在桌面上的（备忘录和待办）、以及还没做完的待办。确认提示会写清要保留几条。</li>
          <li>小纸条顶部多了一条好友：绑过的好友一字排开，点谁的脑袋就看和谁的「咻记录」——谁咻给谁、备忘录还是待办、什么时候。</li>
          <li>右边的「咻记录」看全部往来；服务端新增 <code>GET /api/shares/history</code>，取最近 100 条收发。</li>
        </ul>
      </div>
    </article>`;

const first = s.indexOf(blocks[0]);
const lastBlock = blocks[blocks.length - 1];
const last = s.indexOf(lastBlock) + lastBlock.length;
let region = items.join("\n") + "\n" + entry;
s = s.slice(0, first) + region + s.slice(last);

s = s.replace(/<b>61<\/b><span>个可安装版本（1\.0 → 1\.14\.0）<\/span>/, '<b>62</b><span>个可安装版本（1.0 → 1.15.0）</span>');
s = s.replace(/Qing Tools 从 1\.0 到 1\.14\.0/, "Qing Tools 从 1.0 到 1.15.0");
s = s.replace(/QingTools-1\.14\.0-setup\.exe/g, "QingTools-1.15.0-setup.exe");
s = s.replace(/QingTools-1\.14\.0-portable\.exe/g, "QingTools-1.15.0-portable.exe");
s = s.replace(/v1\.14\.0/g, "v1.15.0");
fs.writeFileSync(p, s);
console.log("entries", items.length, "len", s.length);