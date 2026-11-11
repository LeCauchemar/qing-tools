/**
 * 又拍云（UPYUN）上传封装 —— 只用 node 内置能力，不引入 SDK（SDK 依赖 axios/form-data，
 * 服务端只需要一个 PUT，自己签名更轻）。
 *
 * 凭证不写进代码：放在 <DATA>/../upyun.json，或环境变量 ISLAND_UPYUN_JSON。
 * 文件结构：
 *   { "service": "qing-tools", "operator": "xxx", "password": "xxx",
 *     "domain": "https://qing.ccyyqq.com", "prefix": "island" }
 *
 * 说明：operator/password 只在服务端使用，客户端永远拿不到。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cfg = null;
let cfgAt = 0;

/** 五秒缓存配置，改完 upyun.json 不用重启服务 */
export function upyunConfig(force = false) {
  const file = process.env.ISLAND_UPYUN_FILE || path.join(process.env.ISLAND_DATA || '/www/wwwroot/island/data', '..', 'upyun.json');
  const now = Date.now();
  if (!force && cfg && now - cfgAt < 5000) return cfg;
  cfgAt = now;
  try {
    const raw = process.env.ISLAND_UPYUN_JSON || fs.readFileSync(file, 'utf8');
    const j = JSON.parse(raw);
    cfg = {
      service: String(j.service || '').trim(),
      operator: String(j.operator || '').trim(),
      password: String(j.password || '').trim(),
      domain: String(j.domain || '').trim().replace(/\/+$/, ''),
      prefix: String(j.prefix || 'island').replace(/^\/+|\/+$/g, ''),
      thumbRule: String(j.thumbRule || 'default')
    };
    if (!cfg.service || !cfg.operator || !cfg.password || !cfg.domain) cfg = null;
  } catch (_) {
    cfg = null;
  }
  return cfg;
}

export function upyunReady() {
  return !!upyunConfig();
}

/** 公开可访问的地址（domain 可以随时在 upyun.json 里从测试域名换成正式域名） */
export function publicUrl(key) {
  const c = upyunConfig();
  if (!c) return '';
  const clean = String(key).replace(/^\/+/, '');
  return `${c.domain}/${encodeURI(clean)}`;
}

/** 缩略图地址：又拍云靠 URL 后缀 !default 取缩略图 */
export function thumbUrl(url) {
  const c = upyunConfig();
  if (!url) return '';
  const rule = (c && c.thumbRule) || 'default';
  if (!rule) return url;
  return url + (url.includes('!') ? '' : '!' + rule);
}

/**
 * 又拍云 REST 签名（官方算法）：
 *   Authorization: UPYUN <operator>:<signature>
 *   signature = Base64(HMAC-SHA1(MD5(password), "METHOD&URI&DATE&Content-MD5"))
 * 注意三点（踩过坑）：
 *   1. 参与 HMAC 的 key 是「密码的 MD5 十六进制串」，不是密码原文；
 *   2. 签名串里**没有 Content-Length**，只有 method/uri/date/[content-md5]；
 *   3. 空参数连同前面的 & 一起去掉。
 */
function sign(method, uri, date, md5) {
  const c = upyunConfig();
  const key = crypto.createHash('md5').update(c.password).digest('hex');
  const elems = [method, uri, date];
  if (md5) elems.push(md5);
  const value = elems.join('&');
  const h = crypto.createHmac('sha1', key).update(value, 'utf8').digest('base64');
  return 'UPYUN ' + c.operator + ':' + h;
}

/**
 * 传一个 Buffer 到又拍云。
 * @param {string} key 云端路径，例如 island/chat/room1/abc.png
 * @param {Buffer} buf
 * @param {string} contentType
 * @returns {Promise<{ok:boolean,key?:string,url?:string,message?:string,status?:number}>}
 */
export async function putObject(key, buf, contentType = 'application/octet-stream') {
  const c = upyunConfig();
  if (!c) return { ok: false, message: '又拍云未配置' };
  const clean = String(key).replace(/^\/+/, '');
  const uri = `/${c.service}/${clean}`;
  const date = new Date().toUTCString();
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const res = await fetch('https://v0.api.upyun.com' + uri, {
    method: 'PUT',
    headers: {
      Authorization: sign('PUT', uri, date, md5),
      Date: date,
      'Content-MD5': md5,
      'Content-Type': contentType,
      'Content-Length': String(buf.length)
    },
    body: buf
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, message: text.slice(0, 200) || 'HTTP ' + res.status };
  }
  return { ok: true, key: clean, url: publicUrl(clean) };
}

/** 删除云端对象（失败不抛，日志交给调用方） */
export async function deleteObject(key) {
  const c = upyunConfig();
  if (!c) return { ok: false, message: '又拍云未配置' };
  const clean = String(key).replace(/^\/+/, '');
  const uri = `/${c.service}/${clean}`;
  const date = new Date().toUTCString();
  const res = await fetch('https://v0.api.upyun.com' + uri, {
    method: 'DELETE',
    headers: { Authorization: sign('DELETE', uri, date, ''), Date: date }
  });
  return { ok: res.ok, status: res.status };
}

/** 把本地文件读成 base64 dataURL（客户端本地模式用） */
export function dataUrl(buf, mime = 'image/png') {
  return `data:${mime};base64,${buf.toString('base64')}`;
}
