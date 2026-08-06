/**
 * 引擎窗口最小桥：window.engineBridge（仅 invoke/post 两个原语）
 * 不暴露任何 Node 能力给 qzone 远程页面；引擎经此桥调用主进程能力
 *
 * 引擎脚本运行在隔离世界（ENGINE_WORLD_ID），与 qzone 页面主世界隔离：
 * - 与扩展 content script 的 isolated world 行为一致（共享 DOM/cookie，JS 全局互不干扰）
 * - 避免引擎注入的 jQuery 覆盖 qzone 页面自身 $/$j 导致页面脚本崩溃
 */
const { contextBridge, ipcRenderer } = require('electron');

const ENGINE_WORLD_ID = 100;

const bridge = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  post: (channel, payload) => ipcRenderer.send(channel, payload),
};

contextBridge.exposeInMainWorld('engineBridge', bridge);
contextBridge.exposeInIsolatedWorld(ENGINE_WORLD_ID, 'engineBridge', bridge);

