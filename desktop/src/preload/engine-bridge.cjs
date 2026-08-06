/**
 * 引擎窗口最小桥：window.engineBridge（仅 invoke/post 两个原语）
 * 不暴露任何 Node 能力给 qzone 远程页面；引擎经此桥调用主进程能力
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engineBridge', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  post: (channel, payload) => ipcRenderer.send(channel, payload),
});
