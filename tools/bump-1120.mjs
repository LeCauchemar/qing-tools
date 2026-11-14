import fs from 'node:fs';

const VER = '1.12.0';
const today = '11-13';

// 1) package.json
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = VER;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('pkg', pkg.version);

// 2) site/changelog.html
const clPath = 'site/changelog.html';
let cl = fs.readFileSync(clPath, 'utf8');
cl = cl.replace('<b>57</b>', '<b>58</b>');
cl = cl.replace('（1.0 → 1.11.0）', '（1.0 → 1.12.0）');
cl = cl.replace(/v1\.11\.0/g, 'v' + VER);
cl = cl.replace(/QingTools-1\.11\.0-setup\.exe/g, 'QingTools-' + VER + '-setup.exe');
cl = cl.replace(/QingTools-1\.11\.0-portable\.exe/g, 'QingTools-' + VER + '-portable.exe');

const entry = [
  '    <article class="cl-item v1">',
  '      <div class="cl-side"><b>' + VER + '</b><i>' + today + '</i></div>',
  '      <div class="cl-body">',
  '        <h3>Qing 事项、账号归属、频道跟着账号走</h3>',
  '        <ul>',
  '          <li><b>备忘录和待办合成一个「Qing 事项」。</b>输入框上方两个 chip 选类型：备忘录照旧；待办前面多一个圆圈，点一下打勾（会划掉并变淡）。小工具里那张待办卡整张撤掉，不再两边各记一份。</li>',
  '          <li><b>待办建好自动钉在桌面右上角</b>，到点看得见；钉住的条目（备忘录和剪贴板一样）删除按钮会置灰，先取消钉在桌面才能删 —— 免得「全部删除」误伤。</li>',
  '          <li><b>登录后能把本机旧数据归到账号名下。</b>设置页会出现一张归属卡片，写清「N 条备忘录 · N 个待办 · N 条提醒 · N 个纪念日」，可以「先导出备份」再「归到这个账号」；本机与账号的数据分区存放，登录退出各用各的，不会串号。</li>',
  '          <li><b>频道跟着账号走。</b>登录后本机已有的频道会逐个认领到账号名下（先到先得，别人认领过就跳过）；换台电脑登同一个账号，频道会自动加回来。</li>',
  '          <li><b>设置页最下面多了「退出登录」</b>，只退出这台电脑；同一账号在别的设备上仍然登录着。</li>',
  '        </ul>',
  '      </div>',
  '    </article>',
  ''
].join('\n');

const last = cl.lastIndexOf('</section>');
cl = cl.slice(0, last) + entry + cl.slice(last);
fs.writeFileSync(clPath, cl, 'utf8');
console.log('changelog len', cl.length, 'has new entry', cl.includes('<b>' + VER + '</b>'));

// 3) site/index.html 版本串
const idxPath = 'site/index.html';
let idx = fs.readFileSync(idxPath, 'utf8');
idx = idx.split('1.11.0').join(VER);
fs.writeFileSync(idxPath, idx, 'utf8');
console.log('index replaced', (idx.match(new RegExp(VER.replace(/\./g, '\\.'), 'g')) || []).length);

// 4) README
const rdPath = 'README.md';
let rd = fs.readFileSync(rdPath, 'utf8');
rd = rd.split('1.11.0').join(VER);
rd = rd.replace(
  /^\| \*\*备忘录\*\* \|.*$/m,
  '| **Qing 事项** | 备忘录和待办合成一页：输入框上方两个 chip 选「备忘录」还是「待办」，待办前面带一个圆圈，点一下打勾（划掉并变淡）。正文是富文本，图片可以放在任意位置（编辑时 `Ctrl+V` 插在光标处），点图看大图；右键有「粘贴到这里 / 编辑内容 / 复制 / 发到小纸条 / 钉到桌面 / 删除」，编辑框里还有「剪切 / 复制 / 粘贴 / 粘贴图片 / 全选」；待办建好会**自动钉到桌面右上角**；钉住的条目删除按钮置灰，先取消钉在桌面才能删 |'
);
rd = rd.replace(
  /^\| \*\*待办 \+ 番茄钟\*\* \|.*$/m,
  '| **频道跟账号** | 登录后本机已有的频道会逐个认领到账号名下（先到先得）；换台电脑登同一个账号，频道自动加回来，不用再问一次匹配码 |'
);
rd = rd.replace(
  /^\| \*\*小工具\*\* \| 一页七张卡片.*$/m,
  '| **小工具** | 一页八张卡片（计时器 / 提醒事项 / 倒数日 / 免打扰 / 开发小工具 / 邮件账户 / 手机验证码同步 / 系统），平时只显示一行摘要，点一下展开、再点收起；计时器（时 / 分 / 秒，到点响铃 + 通知）与免打扰（15 分钟 ~ 一直开着）；**邮箱账户与手机密钥也搬到这里了**（设置页只留通用项）；计时中岛的右侧挂一个带进度环的小圆圈，像灵动岛那样一直能看到剩余时间 |'
);
fs.writeFileSync(rdPath, rd, 'utf8');
console.log('readme len', rd.length, 'qing', rd.includes('Qing 事项'));

// 5) CHANGELOG.md
const mdPath = 'CHANGELOG.md';
let md = fs.readFileSync(mdPath, 'utf8');
md = md.replace(/57 个可安装版本/g, '58 个可安装版本');
md = md.replace(/到 1\.11\.0/g, '到 ' + VER);
md = md.replace(/到 1\.12\.0（/g, '到 ' + VER + '（');
const mdEntry = [
  '',
  '## ' + VER + ' · Qing 事项、账号归属、频道跟着账号（11-13）',
  '',
  '- 备忘录与待办合并成「Qing 事项」：输入框上方 chip 选类型，待办带圆圈可打勾，小工具里的待办卡撤掉。',
  '- 待办建好自动钉到桌面右上角；钉住的备忘录 / 剪贴板条目删除按钮置灰，先取消钉在桌面才能删。',
  '- 登录后可在设置页把本机旧数据归到账号名下（先导出备份再归），本机与账号分区存放，互不串号。',
  '- 频道跟着账号走：本机频道逐个认领（先到先得），换电脑登同一账号自动加回来。',
  '- 设置页最下面新增「退出登录」，只退出这台电脑；服务端新增 `rooms.owner_user_id` 与 `POST /api/rooms/claim`、`GET /api/me/rooms`。',
  '',
  '---',
  ''
].join('\n');
const mdAnchor = '## 几个绕不过去的工程决定';
const pos = md.indexOf(mdAnchor);
md = pos >= 0 ? md.slice(0, pos) + mdEntry + md.slice(pos) : md + mdEntry;
fs.writeFileSync(mdPath, md, 'utf8');
console.log('changelog.md len', md.length);
