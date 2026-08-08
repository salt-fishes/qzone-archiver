/**
 * 收藏标准化（P3，迁移自 api.js API.Favorites.convert）
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.Favorites = {
  /**
   * 转换数据
   */
  convert(data) {
    if (!data) {
        return data;
    }
    for (var i = 0; i < data.length; i++) {
        let temp = data[i];
        temp.custom_create_time = API.Utils.formatDate(temp.create_time);
        temp.custom_uin = QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin;
        temp.custom_name = QZone.Common.Target.nickname;
        temp.custom_abstract = temp.abstract || "";
        temp.album_info = temp.album_info || {};
        temp.blog_info = temp.blog_info || {};
        temp.photo_list = temp.photo_list || [];
        temp.shuoshuo_info = temp.shuoshuo_info || {};
        temp.share_info = temp.share_info || {};
        temp.url_info = temp.url_info || {};
        // 源信息
        temp.source_info = {};
        // 多媒体-配图
        temp.custom_images = temp.img_list || [];
        temp.custom_origin_images = temp.origin_img_list || [];
        // 多媒体-视频
        temp.source_info.video_list = [];
        temp.custom_videos = [];
        // 多媒体-歌曲
        temp.source_info.music_list = [];
        temp.custom_audios = [];
        switch (temp.type) {
            case 1:
                // 网页                   
                temp.source_info.video_list = temp.url_info.video_list || [];
                temp.source_info.music_list = temp.url_info.music_list || [];
                break;
            case 2:
                // 相片
                console.warn('相片类型无需处理多媒体', temp);
                break;
            case 3:
                // 日志                    
                temp.source_info.video_list = temp.blog_info.video_list || [];
                temp.source_info.music_list = temp.blog_info.music_list || [];
                break;
            case 4:
                // 照片或相册？
                temp.source_info.video_list = temp.album_info.video_list || [];
                temp.source_info.music_list = temp.album_info.music_list || [];
                break;
            case 5:
                // 说说
                temp.source_info.video_list = temp.shuoshuo_info.video_list || [];
                temp.source_info.music_list = temp.shuoshuo_info.music_list || [];
                temp.shuoshuo_info.detail_shuoshuo_info = temp.shuoshuo_info.detail_shuoshuo_info || {};
                break;
            case 6:
                // 文本
                console.warn('文本类型无需处理多媒体', temp);
                break;
            case 7:
                // 分享
                temp.share_info.reason = temp.share_info.reason.split('||')[0];
                temp.source_info.video_list = temp.share_info.video_list || [];
                temp.source_info.music_list = temp.share_info.music_list || [];
                break;
            default:
                console.warn('其他收藏类型或未知类型不转换数据', temp);
                break;
        }
        // 统一处理多媒体信息
        // 原始配图
        for (let index = 0; index < temp.custom_origin_images.length; index++) {
            const url = temp.custom_origin_images[index];
            temp.custom_origin_images[index] = {
                url: url
            };
        }
        // 缩略配图
        for (let index = 0; index < temp.custom_images.length; index++) {
            const url = temp.custom_images[index];
            temp.custom_images[index] = {
                url: url
            };
            if (temp.type === 1) {
                temp.custom_origin_images[index] = {
                    url: url
                };
                continue;
            }
        }
        // 视频
        for (const video of temp.source_info.video_list) {
            temp.custom_videos.push(video.video_info);
        }
        // 歌曲
        for (const music of temp.source_info.music_list) {
            temp.custom_audios.push(music.music_info);
        }
        // 处理完成后，移除来源信息
        delete temp.source_info;
    }
    return data;
  }
};
