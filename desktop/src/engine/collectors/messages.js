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

    // 同时请求数（15 并发 + 页间限流，兼顾速度与风控）
    const _items = _.chunk(items, 15);

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
      // 每一批次完成后短暂停留（页内已有 0.3~0.8s 限流，批次间隔从 500ms 降至 200ms）
      await API.Utils.sleep(200);
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

  /**
   * 获取单页的说说列表（迁移自 modules/messages.js getList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  async getList(pageIndex, indicator) {
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    // 网络获取委托采集层（P2），模块保留 indicator/convert 编排
    const data = await QZoneCollectors.Messages.getListRaw(pageIndex);

    // 更新状态-下载中的数量
    indicator.addDownload(QZone_Config.Messages.pageSize);

    // 返回的总数包括无权限的说说的条目数，这里返回为空时表示无权限获取其他的数据
    if (data.msglist == null || data.msglist.length == 0) {
        return [];
    }

    // 更新状态-总数
    QZone.Messages.total = data.total || QZone.Messages.total || 0;
    indicator.setTotal(QZone.Messages.total);

    let items = data.msglist || [];

    // 转换数据
    items = API.Messages.convert(items);

    // 更新状态-下载成功数
    indicator.addSuccess(items);

    return items;
  },

  /**
   * [实验性] 恢复已删除说说（迁移自 modules/messages.js getDeletedMessages）
   * 策略：
   *   1. 从好友互动消息列表（feeds2_html_pav_all）拉取所有通知
   *   2. 解析每条通知 HTML，提取被操作说说的 tid
   *   3. 与现有说说列表按 tid 对比，差集即为已删除说说候选
   *   4. 对每个候选 tid：
   *      - 尝试调用 getFullContent 获取完整说说（可能服务端也删了）
   *      - 尝试调用 getComments 获取评论
   *      - 尝试获取点赞列表
   *      - 上述任一失败时，回退到从通知 HTML 提取的摘要 + 零散评论/点赞
   *   5. 标记 isDeleted: true，格式化时间字段
   * @param {Array} existingItems 现有说说列表（用于去重）
   * @returns {Promise<Array>} 已删除说说列表
   */
  async getDeletedMessages(existingItems) {
    existingItems = existingItems || [];
    const feedsConfig = QZone_Config.Messages.Feeds || {};
    const pageSize = feedsConfig.pageSize || 30;
    const minSec = (feedsConfig.randomSeconds && feedsConfig.randomSeconds.min) || 1;
    const maxSec = (feedsConfig.randomSeconds && feedsConfig.randomSeconds.max) || 2;

    // 进度更新器
    const indicator = new StatusIndicator('Messages_Deleted');
    indicator.setNextTip('恢复已删除说说：拉取互动消息列表...');

    // 1. 现有 tid 集合（用于去重）
    const existingTids = new Set(existingItems.map(m => m.tid));

    // 2. 二分查找获取互动消息总数（进度回调显示到终端面板）
    indicator.setNextTip('探测互动消息总数...');
    const totalCount = await API.Messages.getFeedsCount((msg) => {
        indicator.setNextTip('探测互动消息总数：' + msg);
    });
    console.info('互动消息总数', totalCount);
    if (totalCount === 0) {
        // complete 会把 {nextTip} 替换为 nextTip 内容，并把"正在"→"已"
        indicator.setNextTip('探测结果：0 条（互动消息为空或接口异常）');
        indicator.complete();
        return [];
    }
    indicator.setNextTip(`探测完成：约 ${totalCount} 条互动消息，开始分页拉取...`);
    indicator.setTotal(totalCount);

    // 3. 分页拉取所有 feeds，按 origtid（或文本内容）聚合
    //    聚合结果：Map<key, { tid, abstime, content, imageUrl, comments: [], likes: [] }>
    const aggregated = new Map();
    const totalPages = Math.ceil(totalCount / pageSize);
    let firstFeedLogged = false;
    let wafBlocked = false;
    let consecutiveFailures = 0;
    for (let page = 0; page < totalPages && !wafBlocked; page++) {
        // 暂停/取消检查点：暂停时挂起等待恢复；取消时抛错中止（让上层取消生效）
        await window.checkExportState();
        const offset = page * pageSize;
        try {
            const response = await API.Messages.getFeeds(offset, pageSize);
            // WAF 拦截检测
            if (typeof response === 'string' && response.indexOf('waf.tencent.com') > -1) {
                console.error('[getDeletedMessages] 分页拉取被 WAF 拦截，停止拉取', { page, offset });
                indicator.setNextTip(`第 ${page + 1}/${totalPages} 页被 WAF 拦截，已停止`);
                wafBlocked = true;
                break;
            }
            const data = API.Utils.toJson(response, /^_Callback\(/);
            if (!data || data.code !== 0 || !data.data) {
                // 接口异常：连续失败达阈值后停止，避免逐页重复请求（如 501 服务端异常）
                consecutiveFailures++;
                console.warn('[getDeletedMessages] 拉取互动消息分页异常', { page, data });
                if (consecutiveFailures >= 3) {
                    console.warn(`[getDeletedMessages] 连续 ${consecutiveFailures} 页拉取失败，接口异常，停止恢复已删除说说`);
                    indicator.setNextTip(`第 ${page + 1}/${totalPages} 页异常，已停止恢复已删除说说`);
                    break;
                }
                await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
                continue;
            }
            consecutiveFailures = 0;
            // 兼容 data.data.data 和 data.data.feeds 两种结构
            const feeds = data.data.data || data.data.feeds || [];
            if (!feeds.length) continue;
            // 首次成功拉取时记录样本，便于后续调试
            if (!firstFeedLogged) {
                console.info('[getDeletedMessages] 首条 feed 样本', JSON.stringify(feeds[0]).substring(0, 500));
                firstFeedLogged = true;
            }
            for (const feed of feeds) {
                const parsed = API.Messages.parseFeedHtml(feed.html, feed);
                if (!parsed) continue;
                // 聚合 key：优先用 origtid，为空时用文本内容前 80 字符回退
                const aggKey = parsed.origtid || (parsed.content ? parsed.content.substring(0, 80) : '');
                if (!aggKey) continue;
                if (!aggregated.has(aggKey)) {
                    aggregated.set(aggKey, {
                        tid: parsed.origtid || '',
                        abstime: parsed.abstime || 0,
                        content: parsed.content || '',
                        imageUrl: parsed.imageUrl || '',
                        comments: [],
                        likes: []
                    });
                }
                const entry = aggregated.get(aggKey);
                // 聚合评论/点赞信息（来自通知）
                if (parsed.feedType === 'comment' && parsed.commentContent) {
                    entry.comments.push({
                        content: parsed.commentContent,
                        uin: parsed.operator.uin,
                        name: parsed.operator.nickname,
                        time: parsed.operator.time
                    });
                } else if (parsed.feedType === 'like') {
                    entry.likes.push({
                        fuin: parsed.operator.uin,
                        name: parsed.operator.nickname,
                        time: parsed.operator.time
                    });
                }
                // 取最早的 abstime 作为说说发布时间
                if (parsed.abstime && (entry.abstime === 0 || parsed.abstime < entry.abstime)) {
                    entry.abstime = parsed.abstime;
                }
            }
            await indicator.setIndex(offset + feeds.length);
        } catch (e) {
            // 取消：向上传播，让上层中止整个恢复流程
            if (e && e.__exportCancelled) throw e;
            consecutiveFailures++;
            console.error('[getDeletedMessages] 拉取互动消息分页异常', { page, error: e });
            if (consecutiveFailures >= 3) {
                console.warn(`[getDeletedMessages] 连续 ${consecutiveFailures} 页拉取失败，接口异常，停止恢复已删除说说`);
                indicator.setNextTip(`第 ${page + 1}/${totalPages} 页异常，已停止恢复已删除说说`);
                break;
            }
        }
        // 请求间隔
        await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
    }

    // 4. 与现有说说列表对比，差集 = 已删除候选
    //    对比策略：origtid 存在时按 tid 对比；origtid 为空时按文本内容对比
    const existingContents = new Set(
        existingItems.map(m => (m.content || m.custom_content || '').replace(/\s+/g, ' ').trim().substring(0, 80))
            .filter(s => s.length > 0)
    );
    const deletedCandidates = [];
    for (const [key, entry] of aggregated) {
        if (entry.tid && existingTids.has(entry.tid)) continue;
        // tid 为空时用文本内容对比
        if (!entry.tid && entry.content) {
            const normalized = entry.content.replace(/\s+/g, ' ').trim().substring(0, 80);
            if (existingContents.has(normalized)) continue;
        }
        deletedCandidates.push(entry);
    }
    console.info('[getDeletedMessages] 已删除说说候选数', deletedCandidates.length, '聚合总数', aggregated.size);
    if (deletedCandidates.length === 0) {
        indicator.complete();
        return [];
    }

    // 5. 对每个候选尝试获取完整详情、评论、点赞
    indicator.setNextTip('尝试获取已删除说说详情...');
    indicator.setTotal(deletedCandidates.length);
    await indicator.setIndex(0);
    const result = [];
    for (let i = 0; i < deletedCandidates.length; i++) {
        const entry = deletedCandidates[i];
        await indicator.setIndex(i);
        // tid 为空时生成唯一标识（基于时间+内容），用于 SPA 端 key
        const contentSig = (entry.content || '').replace(/\s+/g, '').substring(0, 20);
        const finalTid = entry.tid || `deleted_${entry.abstime || 0}_${contentSig}`;
        const message = {
            tid: finalTid,
            isDeleted: true,
            created_time: entry.abstime,
            custom_create_time: API.Utils.formatDate(entry.abstime),
            content: entry.content,
            custom_content: entry.content,
            commentlist: [],
            custom_comments: [],
            commenttotal: 0,
            likes: [],
            pic_list: [],
            custom_images: [],
            uniKey: API.Messages.getUniKey(finalTid)
        };

        // 尝试获取完整说说详情（tid 为空时跳过）
        try {
            if (!entry.tid) throw new Error('无 tid，跳过详情获取');
            const detailResp = await API.Messages.getFullContent(entry.tid);
            const detailData = API.Utils.toJson(detailResp, /^_Callback\(/);
            if (detailData && (!detailData.code || detailData.code === 0) && detailData.content) {
                // 详情接口成功，覆盖摘要
                message.content = detailData.content;
                message.custom_content = detailData.content;
                message.conlist = detailData.conlist || [];
                if (detailData.created_time) {
                    message.created_time = detailData.created_time;
                    message.custom_create_time = API.Utils.formatDate(detailData.created_time);
                }
                if (detailData.pic_list) {
                    message.pic_list = detailData.pic_list;
                    message.custom_images = detailData.pic_list;
                }
            }
        } catch (e) {
            // 详情接口失败，保留摘要
            console.debug('获取已删除说说详情失败（已用摘要回退）', entry.tid);
        }

        // 尝试获取评论列表（tid 为空时跳过）
        try {
            if (!entry.tid) throw new Error('无 tid，跳过评论获取');
            const comments = await API.Messages.getItemCommentList({ tid: entry.tid }, 0);
            if (comments && comments.length > 0) {
                message.commentlist = comments;
                message.custom_comments = comments;
                message.commenttotal = comments.length;
            } else if (entry.comments.length > 0) {
                // 回退到通知里的零散评论
                message.commentlist = entry.comments.map(c => ({
                    content: c.content,
                    uin: c.uin,
                    name: c.name,
                    create_time: c.time,
                    custom_create_time: API.Utils.formatDate(c.time)
                }));
                message.custom_comments = message.commentlist;
                message.commenttotal = message.commentlist.length;
            }
        } catch (e) {
            // 评论接口失败，回退到通知里的零散评论
            if (entry.comments.length > 0) {
                message.commentlist = entry.comments.map(c => ({
                    content: c.content,
                    uin: c.uin,
                    name: c.name,
                    create_time: c.time,
                    custom_create_time: API.Utils.formatDate(c.time)
                }));
                message.custom_comments = message.commentlist;
                message.commenttotal = message.commentlist.length;
            }
        }

        // 尝试获取点赞列表（复用通用逻辑）
        if (API.Common.isGetLike(QZone_Config.Messages)) {
            try {
                const likeItem = { uniKey: message.uniKey, likes: [] };
                await API.Common.getModulesLikeList(likeItem, QZone_Config.Messages);
                if (likeItem.likes && likeItem.likes.length > 0) {
                    message.likes = likeItem.likes;
                } else if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                }
            } catch (e) {
                if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                }
            }
        } else if (entry.likes.length > 0) {
            message.likes = entry.likes;
        }
        // 统一点赞结构：只保留 likes 数组（likeTotal 为数值，供 HTML 模板显示）
        message.likeTotal = message.likes.length;

        // 通知中的图片URL（可能已失效）
        if (entry.imageUrl && message.pic_list.length === 0) {
            message.custom_images = [{ custom_url: entry.imageUrl, url1: entry.imageUrl, is_video: false }];
        }

        result.push(message);
        indicator.addSuccess(message);
        // 请求间隔
        await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
    }

    console.info('已删除说说恢复完成', { count: result.length });
    indicator.nextTip = '';
    indicator.complete();
    return result;
  },

  /**
   * 添加说说的多媒体下载任务（迁移自 modules/messages.js addMediaToTasks）
   * @param {Array} dataList
   */
  async addMediaToTasks(dataList) {
    if (!dataList) {
        return dataList;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Images_Mime');

    // 下载相对目录
    let module_dir = 'Messages/images';

    for (const item of dataList) {

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载说说配图
        for (const image of item.custom_images) {
            // 说说同时包含图片与视频，需要单独处理视频
            if (image.is_video && image.video_info) {
                // 视频
                const video = image.video_info;
                if (API.Videos.isExternalVideo(video)) {
                    // 外部视频（腾讯视频、第三方视频）不做处理
                    continue;
                }
                // 添加视频下载任务
                API.Videos.addDownloadTasks('Messages', [video], module_dir, item);
            } else {
                // 普通图片
                let url = image.url2 || image.url1;
                await API.Utils.addDownloadTasks('Messages', image, url, module_dir, item, QZone.Messages.FILE_URLS);
            }
            indicator.addSuccess(image);
        }

        // 下载视频预览图及视频
        API.Videos.addDownloadTasks('Messages', item.custom_videos, module_dir, item);
        indicator.addSuccess(item.custom_videos);

        // 下载音乐预览图
        for (const audio of item.custom_audios) {
            // 音乐预览图不识别后缀，直接使用JEPG
            await API.Utils.addDownloadTasks('Messages', audio, audio.image, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }

        // 下载表情
        API.Messages.addDownloadEmoticonTasks(item);

        // 下载趣味表情
        for (const magic of item.custom_magics) {
            await API.Utils.addDownloadTasks('Messages', magic, magic.custom_url, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }

        // 添加评论的配图下载任务
        await API.Common.addCommentImageDownloadTasks(item, 'Messages', indicator)

        // 检查点：每条说说处理完（含视频/表情等同步任务）检查暂停/取消
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
    }

    // 完成
    indicator.complete();
    return dataList;
  },

  /**
   * 说说内容是否包含指定屏蔽词（迁移自 modules/messages.js isMatchFilterKey）
   * @param {string} content 说说内容
   */
  isMatchFilterKey(content) {
    let isMatch = false;
    for (const keyWord of QZone_Config.Messages.FilterKeyWords) {
        const keyWords = keyWord.split('&&');
        let matchCount = 0;
        for (const key of keyWords) {
            const regex = new RegExp(key, 'ig');
            if (content.match(regex)) {
                matchCount++;
            }
        }
        if (matchCount === keyWords.length) {
            isMatch = true;
            break;
        }
    }
    return isMatch;
  },

  /**
   * 过滤含屏蔽词的说说（迁移自 modules/messages.js filterKeyWords）
   * @param {Array} items 说说列表
   */
  filterKeyWords(items) {
    if (!QZone_Config.Messages.isFilterKeyword || QZone_Config.Messages.FilterKeyWords.length === 0) {
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Filter');
    indicator.setTotal(items.length);

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        const isMatch = API.Messages.isMatchFilterKey(item.custom_content);
        if (isMatch) {
            // 包含屏蔽词，移除
            items.splice(i, 1);
            indicator.addSuccess(item);
            continue;
        }
        indicator.addSkip(item);
    }
    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 处理特殊坐标（迁移自 modules/messages.js dealLbs）
   * @param {Array} items 说说列表
   */
  dealLbs(items) {
    for (const item of items) {
        const lbs = item.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        // 特殊坐标处理
        if (Number.parseInt(lbs.pos_x) > 1000000) {
            lbs.pos_x = lbs.pos_x / 1000000
        }
        if (Number.parseInt(lbs.pos_y) > 1000000) {
            lbs.pos_y = lbs.pos_y / 1000000
        }
        // 科学计算法处理
        lbs.pos_x = Number.parseFloat(lbs.pos_x).toString() * 1;
        lbs.pos_y = Number.parseFloat(lbs.pos_y).toString() * 1;
    }
  },

  /**
   * 刷新微信同步说说的坐标信息（迁移自 modules/messages.js refreshWeChatLbsInfo）
   * @param {Array} items 说说
   */
  async refreshWeChatLbsInfo(items) {
    if (!QZone_Config.Messages.refreshWeChatLbs) {
        return;
    }
    // 状态更新器
    const indicator = new StatusIndicator('Messages_Lbs_Info');

    // 更新总数
    indicator.setTotal(items.length);

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        await indicator.setIndex(idx + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份的，跳过
            indicator.addSkip(item);
        }

        if (item.custom_lbsInfo) {
            // 已有坐标信息的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!API.Messages.isWeChat(item)) {
            // 不是微信的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!item.lbs || !item.lbs.idname) {
            // 没有坐标信息的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!QZone_Config.Dev.Maps.TxKey) {
            // 没有API Key的，跳过
            indicator.addSkip(item);
            continue;
        }
        await API.Common.toTxLbs(item.lbs.pos_y, item.lbs.pos_x).then(lbsInfo => {
            if (lbsInfo.status === 0) {
                item.lbs.pos_y = lbsInfo.locations[0].lat;
                item.lbs.pos_x = lbsInfo.locations[0].lng;
            }
        }).catch(e => {
            console.error('转换微信GPS坐标到腾讯火星系坐标异常', item, e);
        });

        await API.Common.getLbsInfo(item.lbs.pos_y, item.lbs.pos_x).then(lbsInfo => {
            if (lbsInfo.status === 0) {
                item.custom_lbsInfo = lbsInfo.result;
                item.lbs.idname = item.custom_lbsInfo.formatted_addresses.recommend;
                item.lbs.name = item.custom_lbsInfo.address;
            }
            indicator.addSuccess(item);
        }).catch(e => {
            console.error('请求坐标信息异常', item, e);
            indicator.addFailed(item);
        });

        await API.Utils.sleep(500);
    }

    // 完成
    indicator.complete();
  },

  /**
   * 添加下载表情任务（迁移自 modules/messages.js addDownloadEmoticonTasks）
   * @param {Message} item
   */
  addDownloadEmoticonTasks(item) {
    if (API.Common.isQzoneUrl() || !API.Common.isNewItem(item)) {
        // QQ空间外链或已备份项，跳过
        return;
    }

    // 说说作者
    API.Common.formatContent(item.name, "HTML", false, false, false, true, false);
    // 说说原文
    API.Common.formatContent(item, "HTML", false, false, false, true, false);

    // 转发说说原文
    item.rt_tid && API.Common.formatContent(item, "HTML", true, false, false, true, false);
    // 转发说说原文作者
    item.rt_tid && API.Common.formatContent(item.rt_uinname, "HTML", true, false, false, true, false);

    // 添加评论的表情下载任务
    API.Common.addCommentEmoticonDownloadTasks(item);

  },
};
