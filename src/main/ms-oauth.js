'use strict';
/**
 * 微软账户 OAuth2（设备代码流，RFC 8628）
 *
 * 为什么需要它：微软从 2024-09 起对 Outlook / Hotmail 个人邮箱停用了
 * IMAP 的「密码 / 授权码」登录，服务器会直接回 `NO Basic authentication is disabled`，
 * 只允许 OAuth2 换到的 access token（imapflow 里就是 `auth.accessToken`）。
 *
 * 设备代码流不需要浏览器回调地址、也不需要客户端密钥，
 * 用户只要在别的设备上打开 microsoft.com/devicelogin 输入一串代码即可。
 */

const TENANT = process.env.ISLAND_MS_TENANT || 'common';
const AUTH = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const SCOPE = 'offline_access openid profile https://outlook.office.com/IMAP.AccessAsUser.All';

// 内置的公共客户端 ID（可在设置里换成自己的）
const DEFAULT_CLIENT_ID = process.env.ISLAND_MS_CLIENT_ID || '';

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    data = {};
  }
  return { status: res.status, ok: res.ok, data };
}

function decodeJwt(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

/** 第一步：拿设备代码（顺便拿用户要输入的那串短码） */
async function startDeviceCode(clientId) {
  const id = String(clientId || DEFAULT_CLIENT_ID || '').trim();
  if (!id) return { ok: false, error: 'no_client_id' };
  const { ok, data } = await postForm(`${AUTH}/devicecode`, { client_id: id, scope: SCOPE });
  if (!ok || !data.device_code) {
    return {
      ok: false,
      error: (data && (data.error_description || data.error)) || 'devicecode_failed'
    };
  }
  return {
    ok: true,
    deviceCode: data.device_code,
    userCode: data.user_code,
    uri: data.verification_uri || 'https://microsoft.com/devicelogin',
    expiresIn: data.expires_in || 900,
    interval: Math.max(3, data.interval || 5),
    message: data.message || ''
  };
}

/** 第二步：轮询换 token（authorization_pending 就继续等） */
async function pollToken(clientId, deviceCode) {
  const id = String(clientId || DEFAULT_CLIENT_ID || '').trim();
  const { ok, data } = await postForm(`${AUTH}/token`, {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: id,
    device_code: deviceCode
  });
  if (ok && data.access_token) {
    const claims = decodeJwt(data.id_token);
    return {
      ok: true,
      pending: false,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresIn: data.expires_in || 3600,
      account: claims.preferred_username || claims.email || claims.upn || ''
    };
  }
  const err = String((data && data.error) || '');
  if (err === 'authorization_pending' || err === 'slow_down') {
    return { ok: false, pending: true, error: err };
  }
  return {
    ok: false,
    pending: false,
    error: err || 'token_failed',
    message: (data && data.error_description) || ''
  };
}

/** 用 refresh token 续期 */
async function refreshAccessToken(clientId, refresh) {
  const id = String(clientId || DEFAULT_CLIENT_ID || '').trim();
  const { ok, data } = await postForm(`${AUTH}/token`, {
    grant_type: 'refresh_token',
    client_id: id,
    refresh_token: refresh,
    scope: SCOPE
  });
  if (ok && data.access_token) {
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refresh,
      expiresIn: data.expires_in || 3600
    };
  }
  return {
    ok: false,
    error: (data && (data.error_description || data.error)) || 'refresh_failed'
  };
}

module.exports = { startDeviceCode, pollToken, refreshAccessToken, DEFAULT_CLIENT_ID, SCOPE, AUTH };
