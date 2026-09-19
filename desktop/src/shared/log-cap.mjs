/**
 * 日志长度兜底截断（v4.9.2）
 * 引擎侧脚本（console 透传 / notify log）万一整包 dump 大对象（接口响应体、
 * 配置长表），不能原样灌进任务日志与 UI 日志流。超长时截断并标注原始长度。
 */
export const MAX_LOG_LEN = 2000;

/** @param {string} text @param {number} [max] @returns {string} */
export function capLog(text, max = MAX_LOG_LEN) {
  const raw = String(text ?? '');
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…（日志截断，原始长度 ${raw.length} 字符）`;
}
