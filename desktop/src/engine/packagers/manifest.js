/**
 * 打包层：备份清单与校验（P5，桌面端新增能力，扩展端无此功能）
 * - manifest.json：备份元数据 + 各模块统计 + 数据文件清单（含 sha256 尽力校验）
 * - report.json   ：备份统计报告
 */
window.QZonePackagers = window.QZonePackagers || {};

QZonePackagers.Manifest = {
  /**
   * 生成备份清单与统计报告（备份完成后由 runner 调用）
   * 输出到备份根目录：manifest.json + report.json
   * @returns {Promise<object>} manifest
   */
  async generate() {
    const root = API.Common.getRootFolder();
    const createdAt = new Date().toISOString();
    const target = QZone.Common.Target || {};
    const owner = QZone.Common.Owner || {};

    // 模块统计
    const modules = {};
    for (const name of MODULE_NAME_LIST) {
      const module = QZone[name] || {};
      let count = 0;
      if (name === 'Photos') {
        count = ((module.Album && module.Album.Data) || []).length;
      } else if (name === 'Boards' || name === 'Visitors') {
        count = module.total || (module.Data && module.Data.total) || 0;
      } else {
        count = (module.Data || []).length;
      }
      modules[name] = {
        count,
        exportType: (QZone_Config[name] || {}).exportType || null
      };
    }

    const manifest = {
      app: 'qzone-archiver-desktop',
      createdAt,
      target: { uin: target.uin, nickname: target.nickname },
      owner: { uin: owner.uin },
      modules,
      files: []
    };

    // 数据文件清单 + sha256 校验（尽力：crypto.subtle 不可用时仅记录 size）
    const rels = await this.collectDataFiles(root);
    for (const rel of rels) {
      const entry = { path: rel };
      try {
        const bytes = await window.QZonePlatform.fs.readFile(root + '/' + rel, 'binary');
        entry.size = bytes.length;
        const sha = await this.sha256(bytes);
        if (sha) entry.sha256 = sha;
      } catch (e) {
        entry.error = String((e && e.message) || e);
      }
      manifest.files.push(entry);
    }

    await API.Utils.writeText(JSON.stringify(manifest, null, 2), root + '/manifest.json');
    console.info('生成备份清单 manifest.json 完成');

    // 统计报告
    const report = {
      app: manifest.app,
      createdAt,
      total: Object.values(modules).reduce((s, m) => s + (m.count || 0), 0),
      modules
    };
    await API.Utils.writeText(JSON.stringify(report, null, 2), root + '/report.json');
    console.info('生成备份统计 report.json 完成');

    return manifest;
  },

  /**
   * 收集需要校验的数据文件（相对备份根目录）
   * @param {string} root Filer 备份根目录
   */
  async collectDataFiles(root) {
    const rels = ['index.html'];
    // 各模块 json 数据
    for (const name of MODULE_NAME_LIST) {
      try {
        const entries = await window.QZonePlatform.fs.list(root + '/' + name + '/json');
        for (const e of entries || []) {
          if (!e.isDirectory && /\.js$/.test(e.name || '')) {
            rels.push(name + '/json/' + e.name);
          }
        }
      } catch (e) {
        /* 模块未导出 json 时跳过 */
      }
    }
    // 用户信息
    try {
      const u = await window.QZonePlatform.fs.readFile(root + '/Common/json/user.js', 'utf8');
      if (u) rels.push('Common/json/user.js');
    } catch (e) {
      /* 跳过 */
    }
    return rels;
  },

  /**
   * 计算 sha256（Web Crypto；隔离世界可用性不定，不可用时返回 null）
   * @param {Uint8Array} bytes
   */
  async sha256(bytes) {
    try {
      if (typeof crypto === 'undefined' || !crypto || !crypto.subtle) return null;
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return null;
    }
  },
};
