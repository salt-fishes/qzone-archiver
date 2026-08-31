/**
 * P5.1（§7.1）路径守卫：主进程内所有「不可信相对路径 → 基目录内绝对路径」的收敛点。
 *
 * 之前 resolveEnginePath（engine fs 映射）与 resource-read 的 `..`/基目录包含校验分散两处、
 * 逻辑重复且强度不一；统一收口到本模块：
 *   - resolveWithin(baseDir, rawPath)  → 基目录内规范化绝对路径，越界返回 null（不抛错）
 *   - assertWithin(baseDir, rawPath)   → 同上，越界抛错（fs 映射语义保持）
 *
 * 规范化采用 path.resolve 逐段展开（`..`/多余分隔符/混合斜杠一并处理），
 * 再以「结果 === 基目录 || 结果以 基目录+sep 开头」做最终包含判定。
 */
import path from 'node:path';

/** 与 engine-bridge.resolveEnginePath 一致的 Filer 根前缀：'/QQ空间备份_uin/...' */
const FILER_ROOT_PREFIX = /^QQ空间备份/;

/**
 * 将不可信相对路径解析到 baseDir 内；越界/非法返回 null。
 * @param {string} baseDir 基目录（绝对）
 * @param {string} rawPath 不可信路径（虚拟 Filer 路径或相对路径）
 * @param {{ stripFilerRoot?: boolean }} [opts] stripFilerRoot：剥离首段 '/QQ空间备份*'（engine fs 映射语义）
 * @returns {string|null}
 */
export function resolveWithin(baseDir, rawPath, opts = {}) {
  const root = path.resolve(baseDir);
  let p = String(rawPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (opts.stripFilerRoot) {
    const segs = p.split('/');
    if (segs.length && FILER_ROOT_PREFIX.test(segs[0])) segs.shift();
    p = segs.join('/');
  }
  if (p.split('/').some((seg) => seg === '..')) {
    // 显式拒绝父级引用（纵深第一层；path.resolve 包含判定本已兜底）
    return null;
  }
  const full = path.resolve(root, p || '.');
  if (full !== root && !full.startsWith(root + path.sep)) {
    return null;
  }
  return full;
}

/**
 * 同 resolveWithin，但越界/非法抛错——供原「throw 非法路径」语义的调用方使用。
 * @returns {string} 基目录内规范化绝对路径
 */
export function assertWithin(baseDir, rawPath, opts = {}) {
  const full = resolveWithin(baseDir, rawPath, opts);
  if (full === null) {
    throw new Error(`非法路径: ${rawPath}`);
  }
  return full;
}
