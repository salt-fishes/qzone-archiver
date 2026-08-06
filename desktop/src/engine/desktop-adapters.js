/**
 * 平台适配层（P1）：QZonePlatform 桌面实现
 *
 * 引擎五层只允许调用本接口，禁止直接调用 chrome.* / Filer / JSZip / saveAs。
 * 所有能力经 window.engineBridge（preload 最小桥）→ 主进程。
 *
 * 接口契约（同时为扩展端未来同构预留）：
 *   storage / fs / zip / download / notify / cookies / network / resources
 */
(function () {
  const bridge = window.engineBridge;
  if (!bridge) {
    console.error('[QZonePlatform] 未检测到 engineBridge preload，适配层不可用');
    return;
  }

  let targetDir = null;

  /** 将待写数据转为可跨 IPC 的 { encoding, data } */
  async function toTransfer(data) {
    if (typeof data === 'string') {
      return { encoding: 'utf8', data };
    }
    if (data instanceof Blob) {
      data = await data.arrayBuffer();
    }
    if (data instanceof ArrayBuffer) {
      return { encoding: 'binary', data: new Uint8Array(data) };
    }
    if (ArrayBuffer.isView(data)) {
      return {
        encoding: 'binary',
        data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      };
    }
    return { encoding: 'utf8', data: String(data) };
  }

  /** base64 → Uint8Array */
  function base64ToUint8(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }

  /**
   * 引擎资源访问（等价扩展端 chrome.runtime.getURL + fetch）
   * 说明：Chromium 不允许 https 页面跨源 fetch 自定义 scheme，故引擎资源一律经 IPC 读取
   *   templates/...      → engine/templates/...
   *   export/...         → engine/export-resources/...（基线快照目录改名）
   *   html/... 等扩展页面资源：桌面端 UI 另行实现，返回空
   */
  function resolveResourcePath(rel) {
    if (!rel) return '';
    let p = String(rel).replace(/^\/+/, '');
    if (p.startsWith('export/')) {
      p = 'export-resources/' + p.slice('export/'.length);
    }
    if (p.startsWith('html/')) {
      console.warn('[QZonePlatform] 扩展页面资源在桌面端不存在:', rel);
      return '';
    }
    return p;
  }

  window.QZonePlatform = {
    setTargetDir(dir) {
      targetDir = dir;
    },
    getTargetDir() {
      return targetDir;
    },

    storage: {
      /** keys: string | string[] | null（null 返回全量） */
      get(keys) {
        const normalized = keys == null ? null : Array.isArray(keys) ? keys : [keys];
        return bridge.invoke('engine:storage-get', { keys: normalized });
      },
      set(items) {
        return bridge.invoke('engine:storage-set', { items: items || {} });
      },
      remove(keys) {
        return bridge.invoke('engine:storage-remove', {
          keys: Array.isArray(keys) ? keys : [keys],
        });
      },
    },

    fs: {
      async writeFile(filepath, data) {
        const t = await toTransfer(data);
        return bridge.invoke('engine:fs-write', { path: filepath, ...t });
      },
      /** encoding: 'utf8' → string；'binary' → Uint8Array */
      async readFile(filepath, encoding = 'utf8') {
        const r = await bridge.invoke('engine:fs-read', { path: filepath, encoding });
        if (!r || r.ok === false) {
          const err = new Error(`readFile 失败: ${filepath}`);
          err.code = r && r.error;
          throw err;
        }
        return r.encoding === 'binary' ? base64ToUint8(r.data) : r.data;
      },
      exists(filepath) {
        return bridge.invoke('engine:fs-exists', { path: filepath });
      },
      mkdir(filepath) {
        return bridge.invoke('engine:fs-mkdir', { path: filepath });
      },
      remove(filepath) {
        return bridge.invoke('engine:fs-remove', { path: filepath });
      },
      /** 返回 Filer 风格条目 [{ name, isDirectory, fullPath }] */
      async list(filepath) {
        const r = await bridge.invoke('engine:fs-list', { path: filepath });
        if (!r || r.ok === false) {
          throw new Error(`list 失败: ${filepath}`);
        }
        return r.entries;
      },
    },

    zip: {
      /** 桌面端打包由主进程 archiver 承担（M2b）；引擎侧仅保留 links.js */
      generate() {
        return Promise.reject(new Error('打包由主进程 archiver 承担（M2b）'));
      },
    },

    download: {
      enqueue(task) {
        return bridge.invoke('engine:download-enqueue', { task });
      },
      pause() {
        return bridge.invoke('download:pause');
      },
      resume() {
        return bridge.invoke('download:resume');
      },
      cancel() {
        return bridge.invoke('download:cancel');
      },
    },

    cookies: {
      /** 读取 httpOnly cookie（主进程 session） */
      get(name) {
        return bridge.invoke('engine:cookie-get', { name });
      },
    },

    network: {
      /** 主进程带 Referer 探测 MIME（等价扩展 background getMimeType） */
      getMimeType(url, timeout) {
        return bridge.invoke('engine:network-mimetype', { url, timeout });
      },
      /** 主进程带 Referer 获取 JSON（等价扩展 background getMapJson） */
      getJson(url) {
        return bridge.invoke('engine:network-json', { url });
      },
    },

    resources: {
      /** 读取引擎本地资源文本（templates 等），等价扩展端 fetch(chrome.runtime.getURL) */
      async readText(rel) {
        const p = resolveResourcePath(rel);
        if (!p) throw new Error(`引擎资源不存在: ${rel}`);
        const r = await bridge.invoke('engine:resource-read', { path: p, encoding: 'utf8' });
        if (!r || r.ok === false) {
          throw new Error(`读取引擎资源失败: ${rel}`);
        }
        return r.data;
      },
      /** 读取引擎本地资源二进制（export-resources 等），返回 Uint8Array */
      async readBinary(rel) {
        const p = resolveResourcePath(rel);
        if (!p) throw new Error(`引擎资源不存在: ${rel}`);
        const r = await bridge.invoke('engine:resource-read', { path: p, encoding: 'binary' });
        if (!r || r.ok === false) {
          throw new Error(`读取引擎资源失败: ${rel}`);
        }
        return base64ToUint8(r.data);
      },
      /** 读取资源并按原样写入目标路径（资源复制） */
      async copyToFile(rel, destPath) {
        const buf = await this.readBinary(rel);
        return bridge.invoke('engine:fs-write', { path: destPath, encoding: 'binary', data: buf });
      },
    },

    notify: {
      progress(data) {
        bridge.post('engine:notify', { type: 'progress', data });
      },
      log(data) {
        bridge.post('engine:notify', { type: 'log', data });
      },
      state(data) {
        bridge.post('engine:notify', { type: 'state', data });
      },
      moduleDone(data) {
        bridge.post('engine:notify', { type: 'module-done', data });
      },
    },
  };

  console.info('[QZonePlatform] 桌面适配层装配完成');
})();
