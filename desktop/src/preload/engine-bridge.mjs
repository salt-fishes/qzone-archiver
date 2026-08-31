/**
 * 引擎窗口最小桥：window.engineBridge（仅 invoke/post 两个原语）
 * 不暴露任何 Node 能力给 qzone 远程页面；引擎经此桥调用主进程能力
 *
 * 引擎脚本运行在隔离世界（ENGINE_WORLD_ID），与 qzone 页面主世界隔离：
 * - 与扩展 content script 的 isolated world 行为一致（共享 DOM/cookie，JS 全局互不干扰）
 * - 避免引擎注入的 jQuery 覆盖 qzone 页面自身 $/$j 导致页面脚本崩溃
 *
 * 安全（P0-2）：仅暴露给隔离世界，绝不暴露主世界——
 * 引擎脚本全部经 executeJavaScriptInIsolatedWorld 注入，唯一消费者是隔离世界内的
 * desktop-adapters.js；主世界暴露属死代码，且会给 qzone 页面任何 XSS/第三方脚本
 * 开放 invoke 原语（如 engine:fs-remove 递归删除用户备份目录）。
 *
 * P1-2：迁移为 ESM（sandbox:false 前提）；ENGINE_WORLD_ID 与主进程
 * services/engine-bridge.js 的导出保持一致（后续可考虑共享常量）。
 */
import { contextBridge, ipcRenderer } from 'electron';

const ENGINE_WORLD_ID = 100;

const bridge = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  post: (channel, payload) => ipcRenderer.send(channel, payload),
};

contextBridge.exposeInIsolatedWorld(ENGINE_WORLD_ID, 'engineBridge', bridge);
