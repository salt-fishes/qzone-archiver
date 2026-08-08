/**
 * 说说采集（P2）
 * 采集循环逐字迁自 modules/messages.js（行为零变化）：
 * 纯采集逻辑集中于此，模块层 export() 编排委托本层。
 * 说明：P2 阶段这些函数仍引用 API.Common/StatusIndicator/QZone 全局（任务层/仓库层在 P3/P6 收口）。
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
   * 获取所有说说列表（迁移自 modules/messages.js getAllList）
   */
  async getAllList() {
    // 说说状态更新器
    const indicator = new StatusIndicator('Messages');
    await indicator.setIndex(1);
    indicator.print();

    // 说说配置项
    const CONFIG = QZone_Config.Messages;

    const nextPage = async function (pageIndex, indicator) {
      // 下一页索引
      const nextPageIndex = pageIndex + 1;

      return await API.Messages.getList(pageIndex, indicator).then(async (dataList) => {
        // 合并数据
        QZone.Messages.Data = API.Utils.unionItems(QZone.Messages.Data, dataList);
        if (!API.Common.isGetNextPage(QZone.Messages.OLD_Data, dataList, CONFIG)) {
          // 不再继续获取下一页
          return QZone.Messages.Data;
        }
        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
      }).catch(async (e) => {
        console.error("获取说说列表异常，当前页：", nextPageIndex, e);
        indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
        // 当前页失败后，跳过继续请求下一页
        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
      });
    };

    // 获取第一页
    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Messages.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Messages.OLD_Data, QZone.Messages.Data);

    // 发表时间倒序
    QZone.Messages.Data = API.Utils.sort(QZone.Messages.Data, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Messages.Data;
  },

  /**
   * 获取所有说说的全文内容（迁移自 modules/messages.js getAllFullContent）
   * @param {Array} items 说说列表
   */
  async getAllFullContent(items) {
    if (!QZone_Config.Messages.isFull) {
      // 不获取全文内容时，跳过不处理
      return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Full_Content');

    // 更新总数
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 更新状态-当前位置
      await indicator.setIndex(i + 1);

      // 当前处理说说（更详细的进度提示：内容摘要前 20 字）
      // 先剥掉 HTML 标签再截断，避免日志里显示原始标签
      const contentSnippet = (item.content || item.custom_content || '')
        .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').substring(0, 20);
      indicator.setItem(contentSnippet || item.tid);

      // 是否有全文
      const hasMoreContent = item.has_more_con === 1 || item.rt_has_more_con === 1;

      if (!hasMoreContent || !API.Common.isNewItem(item)) {
        // 不需要获取全文或者已备份数据跳过不处理
        indicator.addSkip(item);
        continue;
      }

      // 更新状态-下载中的数量
      indicator.addDownload(1);

      // 获取自身说说的全文
      await API.Messages.getFullContent(item.tid).then((data) => {
        // 更新状态-下载成功数
        indicator.addSuccess(item);
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
          // 获取异常
          console.warn('获取所有说说的全文内容异常：', data);
        }

        // 自身全文
        item.content = data.content;
        item.conlist = data.conlist || [];
        // 转发全文
        if (item.rt_tid) {
          item.rt_con = data.rt_con;
        }
      }).catch((e) => {
        console.error("获取说说自身全文异常", item, e);
        indicator.addFailed(item);
      });
    }

    // 完成
    indicator.complete();

    return items;
  },

  /**
   * 获取单条说说的单页评论列表（迁移自 modules/messages.js getItemCommentList）
   */
  async getItemCommentList(item, pageIndex) {
    return await API.Messages.getComments(item.tid, pageIndex).then(async (data) => {
      // 去掉函数，保留json
      data = API.Utils.toJson(data, /^_Callback\(/);
      if (data.code && data.code != 0) {
        // 获取异常
        console.warn('获取单条说说的单页评论列表异常：', data);
        return [];
      }

      // 下载相对目录
      let module_dir = 'Messages/images';

      // 处理说说评论的配图
      let comments = data.commentlist || data.data && data.data.comments || [];

      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        let images = comment.pic || [];
        for (let j = 0; j < images.length; j++) {
          // 处理说说评论的配图
          const image = images[j];
          await API.Utils.addDownloadTasks('Messages', image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
        }

        // 获取评论回复
        let replies = comment.list_3 || [];
        for (let k = 0; k < replies.length; k++) {
          const repItem = replies[k];
          let images = repItem.pic || [];
          for (let r = 0; r < images.length; r++) {
            const image = images[r];
            await API.Utils.addDownloadTasks('Messages', image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
          }
        }
      }
      return comments;
    });
  },

  /**
   * 获取单条说说的全部评论列表（迁移自 modules/messages.js getItemAllCommentList）
   * @param {object} item 说说
   */
  async getItemAllCommentList(item) {
    if (!(item.commenttotal > item.custom_comments.length)) {
      // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
      return item.custom_comments;
    }

    // 清空原有的评论列表
    item.custom_comments = [];

    // 说说评论配置
    const CONFIG = QZone_Config.Messages.Comments;

    // 更新总数
    const total = API.Utils.getCommentCount(item);

    const nextPage = async function (item, pageIndex) {
      // 下一页索引
      const nextPageIndex = pageIndex + 1;

      return await API.Messages.getItemCommentList(item, pageIndex).then(async (dataList) => {
        // 合并评论列表
        item.custom_comments = item.custom_comments.concat(dataList || []);

        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
      }).catch(async (e) => {
        console.error("获取说说评论列表异常，当前页：", pageIndex + 1, item, e);
        // 当前页失败后，跳过继续请求下一页
        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
      });
    };

    await nextPage(item, 0);

    return item.custom_comments;
  },

  /**
   * 获取所有说说的评论列表（迁移自 modules/messages.js getItemsAllCommentList）
   * @param {string} item 说说
   */
  async getItemsAllCommentList(items) {
    if (!QZone_Config.Messages.Comments.isFull) {
      // 不获取全部评论时，跳过
      return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Comments');
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 更新当前位置
      await indicator.setIndex(i + 1);

      if (!API.Common.isNewItem(item)) {
        // 已备份数据跳过不处理
        indicator.addSkip(item);
        continue;
      }

      // 获取说说的全部评论
      await API.Messages.getItemAllCommentList(item);

      // 添加成功
      indicator.addSuccess(item);
    }

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 获取所有图片（超9张需单独获取）（迁移自 modules/messages.js getAllImages）
   * @param {Array} items 说说列表
   */
  async getAllImages(items) {
    if (!items) {
      return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_More_Images');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      // 当前处理位置
      await indicator.setIndex(index + 1);

      if (!API.Common.isNewItem(item)) {
        // 已备份数据跳过不处理
        indicator.addSkip(item);
        continue;
      }

      const images = item.custom_images;
      // 如果图片总数大于图片实际数，则获取更多图片
      if (item.imagetotal <= images.length) {
        // 已备份数据跳过不处理
        indicator.addSkip(item);
        continue;
      }
      await API.Messages.getImageInfos(item.tid).then((data) => {
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
          // 获取异常
          console.warn('获取所有图片异常：', data);
        }

        const imageUrls = data.imageUrls || [];
        for (let index = 0; index < imageUrls.length; index++) {
          // 返回的图片URL
          const url = imageUrls[index];
          // 说说原来的图片对象
          const oldImage = images[index];
          if (oldImage) {
            // 匹配上，则替换(可不替换？)
            oldImage.url1 = url;
            oldImage.url2 = url;
            oldImage.url3 = url;
          } else {
            images.push({
              url1: url,
              url2: url,
              url3: url
            });
          }
        }
        // 已处理
        indicator.addSuccess(item);
      }).catch((error) => {
        // 已失败
        indicator.addFailed(item);
        console.error('获取说说更多图片异常', item, error);
      });
    }

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 获取语音说说的实际地址（迁移自 modules/messages.js getAllVoices）
   * @param {Array} items 说说列表
   */
  async getAllVoices(items) {
    if (!items || !QZone_Config.Messages.GetVoice) {
      return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Voices');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      // 当前处理位置
      await indicator.setIndex(index + 1);

      if (!API.Common.isNewItem(item)) {
        // 已备份数据跳过不处理
        indicator.addSkip(item);
        continue;
      }

      const voices = item.custom_voices;
      if (voices.length === 0) {
        // 没有语音信息跳过
        indicator.addSkip(item);
        continue;
      }
      for (const voice of voices) {
        await API.Messages.getVoiceInfo(voice).then((voiceInfo) => {
          voiceInfo = API.Utils.toJson(voiceInfo, /^_Callback\(/);
          if (voiceInfo.code < 0) {
            // 获取异常
            console.warn('获取语音说说的实际地址异常：', voiceInfo);
          }
          voiceInfo.data = voiceInfo.data || {};
          voice.custom_url = voiceInfo.data.url;
        }).catch((error) => {
          console.error('获取说说语音失败', item, error);
        });
      }

      // 已处理
      indicator.addSuccess(item);
    }
    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 获取说说赞记录（迁移自 modules/messages.js getAllLikeList）
   * @param {Array} items 说说列表
   */
  async getAllLikeList(items) {
    if (!API.Common.isGetLike(QZone_Config.Messages)) {
      // 不获取赞
      return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

    // 获取点赞列表
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
      const list = _items[i];

      let tasks = [];
      for (let j = 0; j < list.length; j++) {

        const item = list[j];
        item.likes = item.likes || [];

        if (!API.Common.isNewItem(item)) {
          // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
          await Promise.all(tasks);
          break end;
        }
        await indicator.setIndex(++count);
        tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Messages).then((likes) => {
          // 获取完成
          indicator.addSuccess(item);
        }).catch((e) => {
          console.error("获取说说点赞异常：", item, e);
          indicator.addFailed(item);
        }));

      }

      await Promise.all(tasks);
      // 每一批次完成后暂停半秒
      await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
  },

  /**
   * 获取单条说说的全部最近访问（迁移自 modules/messages.js getItemAllVisitorsList）
   * @param {object} item 说说
   */
  async getItemAllVisitorsList(item) {
    // 清空原有的最近访问信息
    item.custom_visitor = {
      viewCount: 0,
      totalNum: 0,
      list: []
    };

    // 说说最近访问配置
    const CONFIG = QZone_Config.Messages.Visitor;

    const nextPage = async function (item, pageIndex) {
      // 下一页索引
      const nextPageIndex = pageIndex + 1;

      return await API.Messages.getVisitors(item.tid, pageIndex).then(async (data) => {
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
          // 获取异常
          console.warn('获取单条说说的全部最近访问异常：', data);
        }
        data = data.data || {};

        // 合并
        item.custom_visitor.viewCount = data.viewCount || 0;
        item.custom_visitor.totalNum = data.totalNum || 0;
        item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
      }).catch(async (e) => {
        console.error("获取说说最近访问列表异常，当前页：", pageIndex + 1, item, e);

        // 当前页失败后，跳过继续请求下一页
        // 递归获取下一页
        return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
      });
    };

    await nextPage(item, 0);

    return item.custom_visitor;
  },

  /**
   * 获取说说最近访问（迁移自 modules/messages.js getAllVisitorList）
   * @param {Array} items 说说列表
   */
  async getAllVisitorList(items) {
    if (!API.Common.isGetVisitor(QZone_Config.Messages)) {
      // 不获取最近访问
      return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Visitor');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

    // 获取最近访问
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
      const list = _items[i];

      let tasks = [];
      for (let j = 0; j < list.length; j++) {
        const item = list[j];
        if (!API.Common.isNewItem(item)) {
          // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
          await Promise.all(tasks);
          break end;
        }
        await indicator.setIndex(++count);
        tasks.push(API.Messages.getItemAllVisitorsList(item).then((visitor) => {
          // 获取完成
          indicator.addSuccess(item);
        }).catch((e) => {
          console.error("获取说说最近访问异常：", item, e);
          indicator.addFailed(item);
        }));

      }

      await Promise.all(tasks);
      // 每一批次完成后暂停半秒
      await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
  },
};
