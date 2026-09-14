/**
 * 备份目标头像缓存（渲染层，v4.7 反馈 ②）
 *
 * 图片来源：主进程按 uin 缓存的本地文件 → data URL（IPC avatars:get）。
 * 不直接引 qlogo：渲染层在 file:// 下直连容易被防盗链/混合内容拦掉，
 * 且离线时看不到。同一 uin 只请求一次（失败也记账，避免反复重试刷 IPC）。
 */
import { reactive } from 'vue';

const cache = reactive<Record<string, string | null>>({});
const inflight = new Map<string, Promise<string | null>>();
/** 失败冷却：避免「一次失败永久无头像」，同时防止每次渲染都打 IPC */
const failedAt: Record<string, number> = {};
const RETRY_COOLDOWN_MS = 60_000;

export function avatarOf(uin?: string | number | null): string | null {
  const key = String(uin || '').replace(/\D/g, '');
  if (!key) return null;

  const cached = cache[key];
  if (cached) return cached;

  // 之前失败过：冷却期内不再重试（冷却结束会自动重试，避免永久空头像）
  const lastFail = failedAt[key];
  if (lastFail && Date.now() - lastFail < RETRY_COOLDOWN_MS) return null;

  if (!inflight.has(key)) {
    inflight.set(
      key,
      window.api.avatars
        .get(key)
        .then((r) => {
          const url = r?.dataUrl || null;
          if (url) {
            cache[key] = url;
            delete failedAt[key];
          } else {
            failedAt[key] = Date.now();
          }
          return url;
        })
        .catch((e) => {
          console.warn('[avatars] 获取头像失败', key, e);
          failedAt[key] = Date.now();
          return null;
        })
        .finally(() => inflight.delete(key))
    );
  }
  return null; // 首次调用触发加载，异步完成后由响应式 cache 触发重渲染
}

/** 主动预取（例如进入档案页时批量加载） */
export function prefetchAvatars(uins: (string | number | undefined)[]) {
  for (const u of uins) avatarOf(u);
}
