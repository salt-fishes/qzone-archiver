/**
 * 采集层基类（P2）
 * 职责：分页/重试/WAF 检测/限速/检查点 的可复用原语。
 * 网络请求仍走 api.js（网络原语层，已内建 WAF 检测）；本层封装采集循环通用行为。
 * 纯拿数据：不写文件、不报进度（进度/状态属于任务层，P6 收口）。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.base = {
  /**
   * 暂停/取消检查点（每个分页边界调用）
   * 取消时抛出 __exportCancelled 错误，由任务层捕获中止
   */
  async checkpoint() {
    if (await checkExportState()) {
      const err = new Error('[ExportState] 导出已取消');
      err.__exportCancelled = true;
      throw err;
    }
  },

  /**
   * 翻页限速：请求一页成功后等待 randomSeconds 区间
   * @param {{randomSeconds:{min:number,max:number}}} moduleConfig 模块配置
   */
  async rateLimit(moduleConfig) {
    const min = moduleConfig.randomSeconds.min;
    const max = moduleConfig.randomSeconds.max;
    const seconds = API.Utils.randomSeconds(min, max);
    await API.Utils.sleep(seconds * 1000);
  },

  /** 是否存在下一页（委托 API.Common.hasNextPage，语义一致） */
  hasNextPage(pageIndex, pageSize, total, items) {
    return API.Common.hasNextPage(pageIndex, pageSize, total, items);
  },

  /** 是否继续获取下一页（委托 API.Common.isGetNextPage，增量/边界判断一致） */
  isGetNextPage(oldItems, pageItems, moduleConfig) {
    return API.Common.isGetNextPage(oldItems, pageItems, moduleConfig);
  },

  /** 网络原语透传（api.js 已内建 WAF 检测/重试） */
  get(url, params) {
    return API.Utils.get(url, params);
  },

  post(url, data, options) {
    return API.Utils.post(url, data, options);
  },

  /** JSONP 包装还原 */
  toJson(data, jsonpKey) {
    return API.Utils.toJson(data, jsonpKey);
  },
};
