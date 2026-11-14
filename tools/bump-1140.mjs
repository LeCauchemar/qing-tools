import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (s, a) => {
  if (!s.includes(a)) throw new Error('miss: ' + a);
  return s;
};

// 1) package.json
{
  const p = 'package.json';
  let s = read(p);
  s = must(s, '"version": "1.13.0"').replace('"version": "1.13.0"', '"version": "1.14.0"');
  write(p, s);
}

// 2) site/changelog.html
{
  const p = 'site/changelog.html';
  let s = read(p);
  s = must(s, '<b>60</b>').replace('<b>60</b>', '<b>61</b>');
  s = must(s, '（1.0 → 1.13.0）').replace('（1.0 → 1.13.0）', '（1.0 → 1.14.0）');
  s = s.replace(/十天六十个版本/g, '十天六十一个版本');
  s = s.replace(/从 1\.0 到 1\.13\.0/g, '从 1.0 到 1.14.0');
  s = s.replace(/v1\.13\.0/g, 'v1.14.0');
  s = s.replace(/QingTools-1\.13\.0-setup\.exe/g, 'QingTools-1.14.0-setup.exe');
  s = s.replace(/QingTools-1\.13\.0-portable\.exe/g, 'QingTools-1.14.0-portable.exe');
  const entry = `
    <article class="cl-item v5">
      <div class="cl-side"><b>1.14.0</b><span>11-14</span></div>
      <div class="cl-body">
        <h3>频道跟着账号走：换台电脑，群里还是你</h3>
        <ul>
          <li>登录后加入的频道会记在账号上，换电脑登同一个账号，频道自己回来（先到先得认领，别人抢不走）</li>
          <li>消息带上发送者账号；同一个人开两台电脑，群里只算一个人、只占一票</li>
          <li>@ 与拍一拍按人走：手机式的「u:账号」标记，两台设备同时收到</li>
          <li>投票踢人按人算，过半口径不变；被投的账号会被整体移出这个频道</li>
          <li>已读位置按人保存，一台电脑看过，另一台的红点也灭</li>
        </ul>
      </div>
    </article>
`;
  const idx = s.lastIndexOf('\n  </section>');
  if (idx < 0) throw new Error('no </section>');
  s = s.slice(0, idx) + '\n' + entry + s.slice(idx);
  write(p, s);
}

// 3) site/index.html + README.md 版本串
for (const p of ['site/index.html', 'site/iphone.html', 'site/android.html', 'README.md']) {
  let s = read(p);
  s = s.replace(/1\.13\.0/g, '1.14.0');
  write(p, s);
}

// 4) CHANGELOG.md
{
  const p = 'CHANGELOG.md';
  let s = read(p);
  s = s.replace(/六十个可安装版本/g, '六十一个可安装版本');
  s = s.replace(/到 1\.13\.0/g, '到 1.14.0');
  const sec = `## 1.14.0 · 频道跟着账号走（11-14）

- \`room_members\` 一台设备一行，登录过的设备带 \`user_id\`；消息加 \`user_id\`
- 计票、@、拍一拍按人归并：同一个人两台设备 = 一个人、一票
- 已读位置按人存（\`room_members.last_read_id\`），多端同步红点
- 频道认领 + 换机自动 join（M3/M5 的前半段）一起收口

`;
  const idx = s.indexOf('## 几个绕不过去的工程决定');
  if (idx < 0) throw new Error('no anchor in CHANGELOG');
  s = s.slice(0, idx) + sec + s.slice(idx);
  write(p, s);
}

console.log('bumped 1.14.0');
