/**
 * 任务层——进度上报（P6，迁移自 desktop-runner.js 垫片 StatusIndicator）
 * 接口对齐 content.js StatusIndicator（659-922）：setItem/setTotal/setIndex/setTotalPage/
 * setNextTip/addDownload/addFailed/addSuccess/setFailed/setSuccess/addSkip/setSkip/print/complete
 * 桌面端无提示 DOM，进度经 QZonePlatform.notify.progress 上报。
 */
(function () {
  'use strict';

  /** 阶段中文名（key → 简短名称，用于进度区显示与「已完成」日志） */
  const PHASE_NAMES = {
    InitIncrement: '初始化增量备份',
    Messages: '采集说说列表', Messages_Filter: '过滤说说', Messages_Full_Content: '获取说说全文',
    Messages_More_Images: '获取更多配图', Messages_Comments: '获取评论', Messages_Images_Mime: '识别图片类型',
    Messages_Like: '获取赞列表', Messages_Visitor: '获取最近访问', Messages_Lbs_Info: '刷新定位信息',
    Messages_Export: '导出说说', Messages_Deleted: '恢复已删除说说', Messages_Export_Other: '导出其他说说',
    Blogs: '采集日志列表', Blogs_Content: '获取日志全文', Blogs_Comments: '获取日志评论',
    Blogs_Like: '获取日志赞列表', Blogs_Visitor: '获取日志最近访问', Blogs_Export: '导出日志', Blogs_Export_Other: '导出其他日志',
    Diaries: '采集日记列表', Diaries_Content: '获取日记全文', Diaries_Comments: '获取日记评论',
    Diaries_Like: '获取日记赞列表', Diaries_Visitor: '获取日记最近访问', Diaries_Export: '导出日记', Diaries_Export_Other: '导出其他日记',
    Boards: '采集留言', Boards_Images_Mime: '识别留言图片类型', Boards_Export: '导出留言', Boards_Export_Other: '导出其他留言',
    Friends: '采集好友', Friends_Time: '获取好友互动信息', Friends_Access: '判断空间权限',
    Friends_Care: '获取特别关心', Friends_Export: '导出好友',
    Photos: '采集相册', Photos_Albums_Comments: '获取相册评论', Photos_Albums_Like: '获取相册赞列表',
    Photos_Albums_Visitor: '获取相册最近访问', Photos_Images: '采集相片', Photos_Images_Info: '获取相片详情',
    Photos_Images_Comments: '获取图片评论', Photos_Images_Like: '获取图片赞列表', Photos_Images_Mime: '识别图片类型',
    Photos_Export: '导出相册', Photos_Images_Export: '导出相片', Photos_Images_Export_Other: '导出其他相片',
    Videos: '采集视频', Videos_Comments: '获取视频评论', Videos_Like: '获取视频赞列表', Videos_Export: '导出视频',
    Favorites: '采集收藏', Favorites_Export: '导出收藏', Favorites_Export_Other: '导出其他收藏',
    Shares: '采集分享', Shares_Comments: '获取分享评论', Shares_Like: '获取分享赞列表',
    Shares_Visitor: '获取分享最近访问', Shares_Export: '导出分享', Shares_Export_Other: '导出其他分享',
    Visitors: '采集访客', Visitors_Export: '导出访客', Visitors_Export_Other: '导出其他访客',
    Common_File: '应用内下载', Common_Thunder: '迅雷下载', Common_Thunder_Clipboard: '迅雷（剪贴板）',
    Common_Thunder_Link: '迅雷（链接文件）', Common_Browser: '浏览器下载',
    User_Avatar_Export: '导出头像', Init_User_Info_Export: '初始化用户信息', Init_User_Info_Export_Other: '导出其他用户信息',
    User_Config_Infos: '导出配置', Backup_Save: '保存备份', Backup_Export: '导出备份',
  };
  function phaseName(key) {
    return PHASE_NAMES[key] || key || '';
  }

  /** 静默模式（设置页取相册列表等非备份操作）：抑制进度与阶段日志上报 */
  function suppressed() {
    return !!(window.__engineExportState && window.__engineExportState._suppressProgress);
  }

  class StatusIndicator {
    constructor(key) {
      this.key = key || 'Default';
      this.total = 0;
      this.index = 0;
      this.pageSize = 0;
      this.totalPage = 0;
      this.downloaded = 0;
      this.downloading = 0;
      this.downloadFailed = 0;
      this.skip = 0;
      this.item = '';
      this.tip = phaseName(this.key);
      this.startTime = Date.now();
      this._lastEmitAt = 0; // 进度事件节流时间戳
    }

    setTotal(total) {
      this.total = total;
      this._emit();
      return this;
    }

    setTotalPage(totalPage) {
      this.totalPage = totalPage;
      this._emit();
      return this;
    }

    setNextTip(tip) {
      tip = String(tip == null ? '' : tip);
      if (suppressed()) {
        return this;
      }
      // 阶段提示同步推送日志（如「正在备份评论」「正在获取点赞列表」），去重避免刷屏
      if (tip && tip !== this._lastTip) {
        this._lastTip = tip;
        try {
          window.QZonePlatform.notify.log({ level: 'info', message: tip });
        } catch (e) {
          /* 日志推送失败不阻塞 */
        }
      }
      this.nextTip = tip;
      this._emit();
      return this;
    }

    setItem(name) {
      this.item = String(name == null ? '' : name);
      this._emit();
      return this;
    }

    async setIndex(index) {
      this.index = typeof index === 'number' ? index : String(index);
      this._emit();
      // 检查点：暂停/取消语义与 content.js 一致
      if (await window.checkExportState()) {
        const err = new Error('[ExportState] 导出已取消');
        err.__exportCancelled = true;
        throw err;
      }
      return this;
    }

    addSuccess(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (typeof item === 'number') count = item;
      this.downloaded += count;
      this.downloading = Math.max(0, this.downloading - count);
      this._emit();
      return this;
    }

    setSuccess(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (typeof item === 'number') count = item;
      this.downloaded = count;
      this.downloading = 0;
      this._emit();
      return this;
    }

    addFailed(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (item instanceof window.PageInfo) count = item.size || 1;
      this.downloadFailed += count;
      this.downloading = Math.max(0, this.downloading - count);
      this._emit();
      return this;
    }

    setFailed(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (item instanceof window.PageInfo) count = item.size || 1;
      this.downloadFailed = count;
      this.downloading = 0;
      this._emit();
      return this;
    }

    addSkip(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      this.skip += count;
      this._emit();
      return this;
    }

    setSkip(count) {
      if (Array.isArray(count)) count = count.length;
      this.skip = count;
      this._emit();
      return this;
    }

    addDownload(pageSize) {
      this.downloading = this.downloaded + pageSize;
      this._emit();
      return this;
    }

    print() {
      this._emit();
      return this;
    }

    complete() {
      this.index = this.total || this.index;
      this._emit('complete');
      // 阶段完成里程碑日志（仅映射到中文名的阶段；概要 indicator 无映射自动跳过）
      if (!suppressed() && this.tip && this.tip !== this.key) {
        try {
          window.QZonePlatform.notify.log({ level: 'info', message: `已完成 ${this.tip}` });
        } catch (e) {
          /* 日志推送失败不阻塞 */
        }
      }
      return this;
    }

    _emit(status) {
      if (suppressed()) {
        return;
      }
      // 概要型 indicator（如 Messages_Row_Infos）无 total，无法计算百分比：
      // - running 态跳过，避免 0% 事件覆盖真实阶段进度
      // - complete 态补发 100% 事件，让进度行明确显示模块阶段已结束
      if (!this.total) {
        if (status !== 'complete') {
          return;
        }
        try {
          window.QZonePlatform.notify.progress({
            module: window.__engineExportState.currentModule,
            phase: this.key,
            tip: this.tip,
            done: 1,
            total: 1,
            percent: 100,
            extra: {
              success: this.downloaded,
              failed: this.downloadFailed,
              skip: this.skip,
              item: this.item,
              elapsed: Math.floor((Date.now() - this.startTime) / 1000),
            },
            status: 'complete',
          });
        } catch (e) {
          /* 进度上报失败不阻塞采集 */
        }
        return;
      }
      // 事件节流：相册/点赞等按条目 addSuccess 会产生海量进度事件，IPC 洪水会
      // 淹没渲染器导致前端卡死（引擎本身照常跑）。普通增量限频推送，complete 必发。
      const now = Date.now();
      if (status !== 'complete' && now - this._lastEmitAt < 200) {
        return;
      }
      this._lastEmitAt = now;
      // 防 NaN：index 可能是字符串（如 setIndex(相册名) 仅用于标识当前处理项），
      // 只有数字才参与进度计算，否则字符串除以 total 得到 NaN 导致界面显示 NaN%
      const doneNum = this.downloaded || (typeof this.index === 'number' ? this.index : 0) || 0;
      try {
        window.QZonePlatform.notify.progress({
          module: window.__engineExportState.currentModule,
          phase: this.key,
          tip: this.tip,
          done: doneNum,
          total: this.total,
          percent: this.total ? Math.min(100, Math.round((doneNum / this.total) * 100)) : 0,
          extra: {
            success: this.downloaded,
            failed: this.downloadFailed,
            skip: this.skip,
            item: this.item,
            elapsed: Math.floor((Date.now() - this.startTime) / 1000),
          },
          status: status || 'running',
        });
      } catch (e) {
        /* 进度上报失败不阻塞采集 */
      }
    }
  }
  window.StatusIndicator = StatusIndicator;

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.Progress = { StatusIndicator };
})();
