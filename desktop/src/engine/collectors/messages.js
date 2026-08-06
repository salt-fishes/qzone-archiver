/**
 * 说说采集（P2）
 * 纯拿数据：返回原始响应（{ code, total, msglist }），不含 indicator/convert/写入。
 * 分页/限速/检查点走 QZoneCollectors.base。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Messages = {
  /**
   * 获取单页说说原始数据
   * @param {integer} pageIndex 页索引（0 起）
   * @returns {Promise<{code:number, total:number, msglist:Array}>}
   */
  async getListRaw(pageIndex) {
    const data = await API.Messages.getMessages(pageIndex);
    const json = QZoneCollectors.base.toJson(data, /^_preloadCallback\(/);
    if (json.code && json.code != 0) {
      console.warn('获取单页的说说列表异常：', json);
    }
    return json;
  },

  /**
   * 分页获取全部说说原始列表
   * @param {{pageSize:number, randomSeconds:{min:number,max:number}}} config 模块配置
   * @param {{setTotal:(n:number)=>void}} hooks 每页回调（记录 total 等）
   * @returns {Promise<Array>} 原始 msglist 合并结果
   */
  async getAllListRaw(config, hooks) {
    const pageSize = config.pageSize;
    let total = 0;
    let items = [];
    let pageIndex = 0;
    const seen = new Set();

    while (true) {
      await QZoneCollectors.base.checkpoint();
      const json = await this.getListRaw(pageIndex);
      if (json.msglist == null || json.msglist.length === 0) {
        break;
      }
      total = json.total || total;
      if (hooks && hooks.setTotal) {
        hooks.setTotal(total);
      }
      // 按 tid 去重合并
      for (const item of json.msglist) {
        if (!seen.has(item.tid)) {
          seen.add(item.tid);
          items.push(item);
        }
      }
      if (!QZoneCollectors.base.hasNextPage(pageIndex, pageSize, total, items)) {
        break;
      }
      await QZoneCollectors.base.rateLimit(config);
      pageIndex += 1;
    }
    return items;
  },
};
