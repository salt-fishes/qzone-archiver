/**
 * 头像缓存（v4.7 反馈 ②：备份过的目标要能在界面上看到头像）
 *
 * 为什么不在渲染层直接引 qlogo：
 *   渲染层跑在 file:// 下，直接用 `https://q1.qlogo.cn/g?b=qq&nk=...` 会受
 *   防盗链/混合内容影响，在部分网络下拿不到图（实测该地址直接访问返回 400）。
 *   这里改为主进程用**引擎窗口的 session**（带 QQ 登录态）下载，按 uin 落盘缓存，
 *   渲染层通过 IPC 读取 data URL —— 离线可用，也不怕 CDN 抖动。
 */
import { app, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { windows } from '../windows.js';

const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function avatarDir() {
  return path.join(app.getPath('userData'), 'avatars');
}

function avatarFile(uin) {
  return path.join(avatarDir(), `${String(uin).replace(/\D/g, '')}.img`);
}

/** 头像地址：优先 qlogo（HTTPS，部分机房对 http 有拦截） */
function avatarUrls(uin) {
  const u = String(uin).replace(/\D/g, '');
  return [
    `https://q1.qlogo.cn/g?b=qq&nk=${u}&s=100`,
    `https://qlogo1.store.qq.com/qzone/${u}/${u}/100`,
  ];
}

/** 从响应体猜测图片 mime（用于生成 data URL） */
function mimeOf(buf) {
  if (buf.length > 3 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 3 && buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf.length > 11 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return 'image/png';
}

/** 用引擎窗口 session 发起请求（带登录态），失败回落全局 net */
async function engineFetch(url) {
  const ses = windows.engine && !windows.engine.isDestroyed() ? windows.engine.webContents.session : null;
  const opts = { headers: { Referer: REFERER, 'User-Agent': UA } };
  if (ses && typeof ses.fetch === 'function') {
    return ses.fetch(url, opts);
  }
  return net.fetch(url, opts);
}

export const avatarStore = {
  /** 本地是否已有缓存 */
  has(uin) {
    const f = avatarFile(uin);
    try {
      return fs.existsSync(f) && fs.statSync(f).size > 0;
    } catch {
      return false;
    }
  },

  /** 读取缓存 → data URL（无缓存返回 null） */
  getDataUrl(uin) {
    try {
      const f = avatarFile(uin);
      if (!fs.existsSync(f)) return null;
      const buf = fs.readFileSync(f);
      if (!buf.length) return null;
      return `data:${mimeOf(buf)};base64,${buf.toString('base64')}`;
    } catch (e) {
      console.warn('[avatar-store] 读取头像失败', e);
      return null;
    }
  },

  /**
   * 下载并缓存指定 uin 的头像（幂等：已有缓存直接返回）
   * @returns {Promise<boolean>} 是否可用
   */
  async ensure(uin) {
    const clean = String(uin || '').replace(/\D/g, '');
    if (!clean) return false;
    if (this.has(clean)) return true;

    for (const url of avatarUrls(clean)) {
      try {
        const res = await engineFetch(url);
        if (!res || !res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        // 400/防盗链页面也会是 200 + 少量文本，用图片魔数兜底
        if (buf.length < 64 || !/^\x89PNG|^\xff\xd8|^GIF8|^RIFF/.test(buf.toString('binary'))) continue;
        fs.mkdirSync(avatarDir(), { recursive: true });
        fs.writeFileSync(avatarFile(clean), buf);
        console.info(`[avatar-store] 已缓存头像 uin=${clean}（${buf.length} 字节）`);
        return true;
      } catch (e) {
        console.warn(`[avatar-store] 下载头像失败 uin=${clean} ${url}`, e?.message || e);
      }
    }
    return false;
  },
};
