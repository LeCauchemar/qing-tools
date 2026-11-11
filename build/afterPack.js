'use strict';
/**
 * 打包后瘦身：删掉用不到的多语言包和 Chromium 组件。
 * Electron 本体 ~240MB，安装包里大头是它，这里能砍掉 80MB 左右。
 */
const fs = require('node:fs');
const path = require('node:path');

const DROP_FILES = [
  'LICENSES.chromium.html',
  'LICENSE.electron.txt',
  'LICENSES.chromium.txt',
  'dxcompiler.dll', // WebGPU / Dawn 用的着色器编译器，本项目不用
  'vk_swiftshader.dll', // 软件 Vulkan 后备，本机有显卡用不到
  'vulkan-1.dll'
];

const KEEP_LOCALES = /^(zh-CN|zh-TW|en-US|en-GB)\.pak$/;

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const dir = context.appOutDir;

  for (const name of DROP_FILES) {
    const p = path.join(dir, name);
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    } catch (err) {
      console.warn('[afterPack] skip', name, err.message);
    }
  }

  const locales = path.join(dir, 'locales');
  if (fs.existsSync(locales)) {
    for (const f of fs.readdirSync(locales)) {
      if (KEEP_LOCALES.test(f)) continue;
      try {
        fs.rmSync(path.join(locales, f), { force: true });
      } catch (_) {}
    }
  }
};
