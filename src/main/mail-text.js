'use strict';
/**
 * 邮件正文的轻量解析：剥 HTML、抽验证码、抽可点击链接、生成一句话预览。
 * 纯函数，方便单独 node 跑测试。
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ',
  middot: '·', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  copy: '©', reg: '®', trade: '™', yen: '¥', times: '×', divide: '÷'
};

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (ENTITIES[name.toLowerCase()] !== undefined ? ENTITIES[name.toLowerCase()] : m));
}

function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch (_) {
    return '';
  }
}

/** HTML → 纯文本（保留段落换行，去掉 script/style/注释） */
function stripHtml(html) {
  const raw = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article)\s*>/gi, '\n')
    .replace(/<\/td\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(raw)
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0\u3000]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 把 base64 / quoted-printable 之类已经由 imapflow 解码过的 buffer 转字符串 */
function decodePart(buffer, charset) {
  if (!buffer) return '';
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer));
  const cs = String(charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(cs, { fatal: false }).decode(buf);
  } catch (_) {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } catch (__) {
      return buf.toString('latin1');
    }
  }
}

const CODE_WORDS =
  '(?:验证码|校验码|动态码|确认码|安全码|激活码|验证代码|登录码|口令|' +
  '一次性\\s*(?:代码|密码|口令)|动态\\s*密码|登录\\s*代码|校验\\s*代码|安全\\s*代码|' +
  'verification\\s*code|security\\s*code|login\\s*code|one[\\s-]*time\\s*(?:code|password)|' +
  'auth(?:entication)?\\s*code|passcode|otp|code)';

/** 弱关键词：只用来在多个候选数字之间挑「离说明最近」的那个 */
const CODE_HINT = /(代码|密码|口令|验证|校验|激活|code|passcode|otp|pin)/i;

/** 一次「把被样式拆开的数字拼回来」：微软/银行的验证码常用 <span>2</span><span>4</span> 排版 */
function squeezeDigits(text) {
  return String(text || '')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/(\d)[\s\u00a0]+(?=\d)/g, '$1');
}

/**
 * 抽验证码。优先级：
 *   1. 「验证码」等关键词后面 16 字符内的 4~8 位数字（允许 123 456 这种分组）
 *   2. 数字后面跟着「是你的验证码」这类
 *   3. 全文里唯一出现的 6 位数字
 * 原文与被样式拆开的数字串各跑一遍，取权重最高的。
 */
function extractCode(text) {
  const raw = String(text || '');
  if (!raw) return null;
  const found = [];

  const variants = [raw];
  const sq = squeezeDigits(raw);
  if (sq !== raw) variants.push(sq);

  for (const t of variants) {
    const after = new RegExp(CODE_WORDS + '[^0-9]{0,16}((?:\\d[ \\u00a0]?){4,8})', 'gi');
    let m;
    while ((m = after.exec(t))) {
      const digits = m[1].replace(/\D/g, '');
      if (digits.length >= 4 && digits.length <= 8) found.push({ code: digits, weight: 3, at: m.index });
    }

    const before = new RegExp('((?:\\d[ \\u00a0]?){4,8})[^0-9]{0,12}' + CODE_WORDS, 'gi');
    while ((m = before.exec(t))) {
      const digits = m[1].replace(/\D/g, '');
      if (digits.length >= 4 && digits.length <= 8) found.push({ code: digits, weight: 2, at: m.index });
    }

    const loose = t.match(/(?<!\d)\d{6}(?!\d)/g) || [];
    const uniq = Array.from(new Set(loose));
    if (uniq.length === 1) {
      // 只有一个 6 位数也不一定是验证码（可能是金额、订单号），要求附近有「代码/密码」这类说明
      const at = t.indexOf(uniq[0]);
      const near = t.slice(Math.max(0, at - 60), at + 60);
      if (CODE_HINT.test(near)) found.push({ code: uniq[0], weight: 1, at });
    } else if (uniq.length > 1) {
      // 多个 6 位数：挑「离代码/密码这类说明最近」的那个，避免抓成链接里的 token
      let pick = null;
      for (const c of uniq) {
        const at = t.indexOf(c);
        const near = t.slice(Math.max(0, at - 40), at + 40);
        if (!CODE_HINT.test(near)) continue;
        const gap = Math.min(
          ...Array.from(t.matchAll(new RegExp(CODE_HINT.source, 'gi'))).map((mm) =>
            Math.abs(mm.index - at)
          ),
          999
        );
        if (!pick || gap < pick.gap) pick = { code: c, at, gap };
      }
      if (pick) found.push({ code: pick.code, weight: 1, at: pick.at });
    }
  }

  if (!found.length) return null;
  found.sort((a, b) => b.weight - a.weight || a.at - b.at);
  const best = found[0].code;
  const others = Array.from(new Set(found.map((f) => f.code))).filter((c) => c !== best).slice(0, 4);
  return { code: best, others, weight: found[0].weight };
}

const LINK_BOOST = /(verify|confirm|activat|validat|auth|token|signin|sign-in|login|reset|unlock|click|magic|link\/)/i;
const LINK_NOISE = /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?)(\?|$)/i;

/** 抽链接，去掉图片/跟踪像素，验证类链接排前面 */
function extractLinks(text, limit = 6) {
  const raw = String(text || '').match(/https?:\/\/[^\s<>"'`）)\]】，。、]+/gi) || [];
  const seen = new Set();
  const out = [];
  for (let url of raw) {
    url = url.replace(/[.,;:]+$/, '');
    if (url.length > 900) continue;
    if (LINK_NOISE.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  out.sort((a, b) => Number(LINK_BOOST.test(b)) - Number(LINK_BOOST.test(a)) || a.length - b.length);
  return out.slice(0, limit);
}

/** 一句话预览（给通知条 / 列表用） */
function preview(text, max = 120) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1) + '…';
}

/** 一次性分析：输入正文（HTML 或纯文本），返回 { text, code, links, preview } */
function analyze(body, { isHtml = false } = {}) {
  const looksHtml = isHtml || /<\w+[\s>]/.test(String(body || '').slice(0, 400));
  const text = looksHtml ? stripHtml(body) : String(body || '');
  const codeInfo = extractCode(text);
  const links = extractLinks(text);
  return {
    text,
    code: codeInfo ? codeInfo.code : '',
    codeOthers: codeInfo ? codeInfo.others : [],
    codeWeight: codeInfo ? codeInfo.weight : 0,
    links,
    preview: preview(text)
  };
}

module.exports = { stripHtml, decodeEntities, decodePart, extractCode, extractLinks, preview, analyze };
