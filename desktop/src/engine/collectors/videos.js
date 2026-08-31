/**
 * 视频采集（P2）
 * 采集循环逐字迁自 modules/videos.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Videos = {
  /**
   * 获取一页的视频列表（迁移自 modules/videos.js getPageList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getPageList: async(pageIndex, indicator) => {

      // 状态更新器当前页
      await indicator.setIndex(pageIndex + 1);

      // 更新获取中提示
      indicator.addDownload(QZone_Config.Videos.pageSize);

      return await API.Videos.getVideos(pageIndex).then(data => {
          // 去掉函数，保留json
          data = API.Utils.toJson(data, /^shine0_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取一页的视频列表异常：', data);
          }
          data = data.data || {};

          // 更新总数
          QZone.Videos.total = data.total || QZone.Videos.total || 0;
          indicator.setTotal(QZone.Videos.total);

          let dataList = data.Videos || [];

          for (const item of dataList) {
              item.uniKey = item.shuoshuoid ? API.Messages.getUniKey(item.shuoshuoid) : item.vid;
          }

          //  更新获取成功数据
          indicator.addSuccess(dataList);

          return dataList;
      })
  },

  /**
   * 获取所有视频列表（迁移自 modules/videos.js getAllList）
   */
  getAllList: async() => {
      // 进度更新器
      const indicator = new StatusIndicator('Videos');
      await indicator.setIndex(1);
      indicator.print();

      // 视频配置项
      const CONFIG = QZone_Config.Videos;

      const nextPage = async function(pageIndex, indicator) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Videos.getPageList(pageIndex, indicator).then(async(dataList) => {
              // 合并数据
              QZone.Videos.Data = API.Utils.unionItems(QZone.Videos.Data, dataList);
              if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, dataList, CONFIG)) {
                  // 不再继续获取下一页
                  return QZone.Videos.Data;
              }
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
          }).catch(async(e) => {
              console.error("获取视频列表异常，当前页：", pageIndex + 1, e);
              indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
          });
      }

      await nextPage(0, indicator);

      // 合并、过滤数据
      QZone.Videos.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Videos.OLD_Data, QZone.Videos.Data);

      // 发表时间倒序
      QZone.Videos.Data = API.Utils.sort(QZone.Videos.Data, CONFIG.IncrementField, true);

      // 完成
      indicator.complete();

      return QZone.Videos.Data;
  },

  /**
   * 获取视频赞记录（迁移自 modules/videos.js getAllLikeList）
   * @param {Array} items 日志列表
   */
  getAllLikeList: async(items) => {
      if (!API.Common.isGetLike(QZone_Config.Videos)) {
          // 不获取赞
          return items;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Videos_Like');
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

              if (!item.shuoshuoid) {
                  // 说说ID为空时跳过不获取 TODO 待定
                  indicator.addSkip(item);
                  continue;
              }

              item.uniKey = API.Messages.getUniKey(item.shuoshuoid);

              if (!API.Common.isNewItem(item)) {
                  // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                  await Promise.all(tasks);
                  break end;
              }


              await indicator.setIndex(++count);
              tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Videos).then((likes) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取视频点赞异常：", item, e);
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
   * 获取视频的所有评论（迁移自 modules/videos.js getAllComments）
   * @param {Array} videos 视频列表
   */
  getAllComments: async(videos) => {
    // 视频评论配置
    const CONFIG = QZone_Config.Videos.Comments;

    // 是否获取视频评论
    if (!CONFIG.isGet || API.Videos.isFile()) {
        return videos;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Videos_Comments');
    indicator.setTotal(videos.length);

    for (let index = 0; index < videos.length; index++) {

        const video = videos[index];

        // 当前位置
        await indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 获取评论
        video.cmtTotal = 0;
        video.comments = [];

        if (!video.shuoshuoid) {
            // 说说ID为空时跳过不获取 TODO 待定
            indicator.addSkip(video);
            continue;
        }

        const nextPage = async function(video, pageIndex) {
            // 下一页索引
            const nextPageIndex = pageIndex + 1;

            // TODO，待确认是否存在shuoshuoid为空的情况，相册或视频直接上传？
            return await API.Videos.getComments(video.shuoshuoid, pageIndex).then(async(data) => {

                // 去掉函数，保留json
                data = API.Utils.toJson(data, /^_Callback\(/);
                if (data.code && data.code != 0) {
                    // 获取异常
                    console.warn('获取视频评论异常：', data);
                }
                data = data.data || {};
                data.comments = data.comments || [];

                // 添加评论数到视频
                video.cmtTotal = data.total || video.cmtTotal || 0;

                // 合并数据
                video.comments = API.Utils.unionItems(video.comments, data.comments);

                if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, data.comments, CONFIG)) {
                    // 不再继续获取下一页
                    return video.comments;
                }

                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);

            }).catch(async(e) => {
                console.error("获取视频评论列表异常：", pageIndex + 1, video, e);
                // 当前页失败后，跳过继续请求下一页
                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);
            });
        }

        // 获取第一页评论
        await nextPage(video, 0);

        indicator.addSuccess(video);
    }

    // 完成
    indicator.complete();
    return videos;
  },

  /**
   * 添加视频下载任务（迁移自 modules/videos.js addDownloadTasks）
   * @param {string} module 模块
   * @param {Array} videos 视频列表
   * @param {string} module_dir 模块相对目录
   * @param {object} source 来源
   */
  addDownloadTasks: (module, videos, module_dir, source) => {
    // 是否为视频
    const isVideo = 'Videos' === module;

    if (!videos || API.Common.isQzoneUrl() || (isVideo && QZone_Config.Videos.exportType == 'Link')) {
        // QQ空间外链、视频备份类型为下载链接、则不添加下载任务
        return;
    }

    // 遍历
    for (let idx = 0; idx < videos.length; idx++) {
        // 视频
        const video = videos[idx];

        // 序号，便于排序
        const orderNumber = API.Utils.prefixNumber(idx + 1, videos.length.toString().length);

        if (isVideo && !API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            console.warn("已备份数据跳过不处理", video);
            continue;
        }

        // 添加视频预览图下载任务
        video.custom_pre_url = video.pre || video.url1 || video.preview_img;
        // 预览图直接写死后缀
        video.custom_pre_filename = API.Utils.newSimpleUid(8, 16) + '.jpeg';
        video.custom_pre_filepath = 'images/' + video.custom_pre_filename;
        API.Utils.newDownloadTask(module, video.custom_pre_url, module_dir, video.custom_pre_filename, video);

        // 如果是外部视频，跳过不下载
        if (video.play_url) {
            console.warn("外部视频，跳过", video);
            continue;
        }

        // 添加视频下载任务(视频/相片/收藏/说说)
        video.custom_url = video.url || video.video_url || video.url3;
        if (!video.custom_url || API.Videos.isExternalVideo(video)) {
            // 外部视频跳过不下载
            console.warn("外部视频，跳过", video);
            continue;
        }
        video.custom_filename = API.Videos.getFileName(video.custom_url);
        video.custom_filename = isVideo ? API.Videos.getVideoFileName(video, orderNumber) : video.custom_filename;

        // 添加下载任务
        const categoryPath = API.Videos.getFileStructureFolderPath(video);
        const downloadFolder = categoryPath ? 'Videos/' + categoryPath : 'Videos';

        // 文件路径
        video.custom_filepath = 'images/' + video.custom_filename;
        if (isVideo) {
            video.custom_filepath = categoryPath ? categoryPath + '/' + video.custom_filename : video.custom_filename;
        }

        API.Utils.newDownloadTask(module, video.custom_url, isVideo ? downloadFolder : module_dir, video.custom_filename, source || video);
    }
    return videos;
  },

  /**
   * 添加下载表情任务（迁移自 modules/videos.js addDownloadEmoticonTasks）
   * @param {Videos} item
   */
  addDownloadEmoticonTasks: (items) => {
    if (API.Common.isQzoneUrl()) {
        return;
    }

    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // QQ空间外链或已备份项，跳过
            continue;
        }

        // 视频描述
        item.name && API.Common.formatContent(item.name, 'HTML', false, false, false, true, false);

        // 添加评论的表情下载任务
        API.Common.addCommentEmoticonDownloadTasks(item);
    }

  },

  /**
   * 获取腾讯视频的播放地址（迁移自 modules/videos.js getTencentVideoUrl）
   * @param {string} vid 视频ID
   */
  getTencentVideoUrl: (vid) => {
    let params = {
        "origin": "https://user.qzone.qq.com",
        "vid": vid,
        "autoplay": true,
        "volume": 100,
        "disableplugin": "IframeBottomOpenClientBar",
        "additionplugin": "IframeUiSearch",
        "platId": "qzone_feed",
        "show1080p": true,
        "isDebugIframe": false
    }
    return API.Utils.toUrl('https://v.qq.com/txp/iframe/player.html', params);
  },

  /**
   * 获取视频连接（迁移自 modules/videos.js getVideoUrl）
   * @param {object} 视频信息
   */
  getVideoUrl: (video) => {
    // URL3个人相册视频？
    let url = video.url3 || video.url;
    if (video.source_type == "share") {
        // 分享视频连接？
        url = video.rt_url;
    }
    if (API.Videos.isTencentVideo(video)) {
        // 腾讯视频
        if (!video.video_id) {
            return video.url2;
        }
        url = API.Videos.getTencentVideoUrl(video.video_id);
    }
    // 其他第三方视频
    return url;
  },

  /**
   * 是否腾讯视频（判断不严谨，先临时判断）（迁移自 modules/videos.js isTencentVideo）
   * @param {object} 视频信息
   */
  isTencentVideo: (video) => {
    let url2 = video.url2 || '';
    let url3 = video.url3 || '';
    if (!url2 || url3.indexOf('.mp4') > -1) {
        // 如果URL都没有值，或者地址含有.mp4，肯定是空间视频？
        return false;
    }
    if (url3.indexOf('tencentvideo') > -1) {
        // 该判断不严谨，但是不知道怎么判断的好
        return true;
    }
    return false;
  },

  /**
   * 是否外部视频（判断不严谨，先临时判断）（迁移自 modules/videos.js isExternalVideo）
   * @param {object} 视频信息
   */
  isExternalVideo: (video) => {
    let url3 = video.url3 || '';
    const isTencentTV = API.Videos.isTencentVideo(video);
    if (isTencentTV) {
        return true;
    }
    if (url3.indexOf('.swf') > -1) {
        // Flash地址肯定是外部视频？
        return true;
    }
    return false;
  },

  /**
   * 导出类型是否文件（迁移自 modules/videos.js isFile）
   */
  isFile: () => {
    return QZone_Config.Videos.exportType == 'File' || QZone_Config.Videos.exportType == 'Link'
  },

  /**
   * 获取视频名称（迁移自 modules/videos.js getVideoFileName）
   * @param {Object} video 视频
   * @param {String} prefix 前缀
   * @returns
   */
  getVideoFileName: (video, prefix) => {
    // 上传时间
    const dateTime = API.Utils.parseDate(video.uploadtime || video.uploadTime).getTime();
    if (QZone_Config.Videos.RenameType === 'Default') {
        // 文件名称，排序号+空间名称
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.custom_filename);
    } else if (QZone_Config.Videos.RenameType === 'Name') {
        // 文件名称，排序号+视频标题
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + (video.title || API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss')));
    } else if (QZone_Config.Videos.RenameType === 'Time') {
        // 文件名称，排序号+视频标题+拍摄/上传时间
        if (video.title) {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.title + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        } else {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        }
    }
    // 追加后缀
    video.custom_filename = video.custom_filename.endsWith('.mp4') ? video.custom_filename : video.custom_filename + '.mp4';
    video.custom_filename = API.Utils.filenameValidate(video.custom_filename);
    return video.custom_filename;
  },
};
