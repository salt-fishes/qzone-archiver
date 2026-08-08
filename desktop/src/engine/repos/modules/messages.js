/**
 * 说说标准化（P3，迁移自 modules/messages.js convert）
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.Messages = {
  /**
   * 处理数据
   * @param items 需要转换的数据
   */
  convert(items) {
    items = items || [];
    for (const item of items) {
        // 内容
        item.custom_content = item.content;
        item.conlist = item.conlist || [];

        // 评论
        item.commenttotal = API.Utils.getCommentCount(item);
        item.custom_comments = item.commentlist || [];

        // 配图
        item.imagetotal = item.pictotal || 0;
        item.custom_images = item.pic || [];

        // 语音
        item.voicetotal = item.voicetotal || 0;
        item.custom_voices = item.voice || [];

        // 音乐
        item.audiototal = item.audiototal || 0;
        item.custom_audios = item.audio || [];

        // 特殊动漫表情
        item.magictotal = item.magictotal || 0;
        item.custom_magics = item.magic || [];
        // 处理表情
        for (const magic of item.custom_magics) {
            if (magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)) {
                magic.custom_url = 'http://qzonestyle.gtimg.cn/qzone/em/120/mb{0}.jpg'.format(magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)[1]);
            }
        }

        // 视频
        item.videototal = item.videototal || 0;
        item.custom_videos = item.video || [];
        for (const video of item.custom_videos) {
            // 处理异常数据的视频URL
            video.video_id = video.video_id || '';
            video.video_id = video.video_id.replace("http://v.qq.com/", "");
        }

        // 投票

        // 位置
        item.lbs = item.lbs || {};

        // 创建时间
        item.custom_create_time = API.Utils.formatDate(item.created_time);

        // 添加点赞Key
        item.uniKey = API.Messages.getUniKey(item.tid);
    }
    return items;
  }
};
