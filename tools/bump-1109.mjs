import fs from 'node:fs';

// README
{
  const p = 'README.md';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    /(\| 待办[^|]*\|[^\n]*\|[^\n]*\|)/,
    '$1\n| 提醒事项 | 到点抖动 + 岛边缘彩虹灯；快捷 5 分钟/30 分钟/明天此时或自定义时间；可推迟 5 分钟、可勾完成 | shake + mask 彩虹边，无新窗口 |'
  );
  s = s.replace(
    /(\| 提醒事项[^\n]*\|)/,
    '$1\n| 倒数日 | 每月发薪日（自选 1-31）+ 下一个法定假日 + 自定义纪念日（每年/一次性）；当天首次启动弹条提醒 | 复用 festivalOf() 算节假日 |'
  );
  s = s.replace(/(时间戳\s*·\s*Base64\s*·\s*JSON\s*·\s*UUID\s*·\s*哈希)/, '$1 · 随机');
  s = s.replaceAll('1.10.8', '1.10.9');
  fs.writeFileSync(p, s);
  console.log('readme ok');
}

// changelog.html
{
  const p = 'site/changelog.html';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replaceAll('1.10.8', '1.10.9');
  s = s.replace(/<b>53<\/b>/, '<b>54</b>');
  s = s.replace(/七天五十三个版本/g, '七天五十四个版本');
  const entry = [
    '',
    '    <div class="cl-item v3">',
    '      <div class="cl-side"><b>1.10.9</b><span>11-11</span></div>',
    '      <div class="cl-main">',
    '        <h3>两张新卡：提醒事项 + 倒数日；开发小工具加随机面板</h3>',
    '        <ul>',
    '          <li>小工具页从 7 张卡涨到 9 张：新加「提醒事项」和「倒数日」，还是折叠式的、默认全收起。</li>',
    '          <li>提醒事项：写一句话 + 选个时间（快捷 5/10/30 分钟、1 小时、明天此时，或自定义 datetime-local），到点会像拍一拍那样抖一下，岛的<b>边缘</b>跑彩虹灯（不铺满、不盖内容）。支持推迟 5 分钟、勾完成。</li>',
    '          <li>倒数日：每月发薪日（自己选 1-31）、下一个法定假日（春节/五一/国庆/中秋…）、自定义纪念日（每年重复或一次性），到了那天首次启动会弹条提醒。</li>',
    '          <li>开发小工具新增「随机」tab：抛硬币、掷骰子、1-100 随机数、抽签（每行一个选项随机挑一个）。</li>',
    '        </ul>',
    '      </div>',
    '    </div>',
    ''
  ].join('\n');
  s = s.replace('\n  </section>\n\n  <footer class="foot">', entry + '\n  </section>\n\n  <footer class="foot">');
  fs.writeFileSync(p, s);
  console.log('changelog.html ok');
}

// CHANGELOG.md
{
  const p = 'CHANGELOG.md';
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/53 个可安装版本/, '54 个可安装版本');
  s = s.replace(/到 1\.10\.8/, '到 1.10.9');
  const md = [
    '',
    '## 1.10.9 · 提醒事项 + 倒数日 + 随机面板（11-11）',
    '',
    '- **两张新卡**：小工具页从 7 张涨到 9 张（提醒事项、倒数日），还是折叠式的。',
    '- **提醒事项**：一句话 + 时间（快捷 5/10/30 分钟、1 小时、明天此时，或 datetime-local 自定义）；到点 shakeIsland 抖一下 + 岛的**边缘**跑彩虹灯（mask 只留边框）。支持推迟 5 分钟、勾完成。',
    '- **倒数日**：每月发薪日（自选 1-31）、下一个法定假日（用现有 festivalOf() 算）、自定义纪念日（每年/一次性）。到了那天首次启动会弹条提醒。',
    '- **随机面板**：开发小工具新增第 6 个 tab，抛硬币 / 掷骰子 / 1-100 随机数 / 抽签。',
    '- 后端：store.data.reminders / countdowns，主进程每 2 秒 tick，到点 send reminder:fire。',
    '- 彩虹边用 mask-composite: exclude 只留边框，内容区干净。',
    '',
    ''
  ].join('\n');
  s = s.replace('## 几个绕不过去的工程决定', md + '## 几个绕不过去的工程决定');
  fs.writeFileSync(p, s);
  console.log('CHANGELOG.md ok');
}

// 其它站点页版本串
for (const p of ['site/index.html', 'site/iphone.html', 'site/android.html']) {
  let s = fs.readFileSync(p, 'utf8');
  s = s.replaceAll('1.10.8', '1.10.9');
  fs.writeFileSync(p, s);
  console.log(p, 'bumped');
}
