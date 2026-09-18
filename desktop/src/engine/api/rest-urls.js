/**
 * QQ空间Rest API配置
 */
const REST_URLS = {

    /** 空间概览信息，可用于判断权限 */
    USER_OVERVIEW_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi",

    /** 个人信息 */
    USER_INFO_URL: "https://user.qzone.qq.com/proxy/domain/base.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all",

    /** 说说列表URL */
    MESSAGES_LIST_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6",

    /** 说说详情URL */
    MESSAGES_DETAIL_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6",

    /** 说说配图URL */
    MESSAGES_IMAGES_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_get_pics_v6",

    /** 说说、视频评论列表URL */
    MESSAGES_VIDEOS_COMMONTS_URL: "https://user.qzone.qq.com/proxy/domain/taotao.qzone.qq.com/cgi-bin/emotion_cgi_getcmtreply_v6",

    /** 日志列表URL */
    BLOGS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs",

    /** 日志阅读数URL */
    BLOGS_READ_COUNT_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_count",

    /** 日志评论列表URL */
    BLOGS_COMMENTS_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_comment_list",

    /** 日志详情URL */
    BLOGS_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/blog_output_data",

    /** 私密日志列表URL */
    DIARY_LIST_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_get_titlelist",

    /** 私密日志详情URL */
    DIARY_INFO_URL: "https://user.qzone.qq.com/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_output_data",

    /** 相册路由URL */
    PHOTOS_ROUTE_URL: 'https://user.qzone.qq.com/proxy/domain/route.store.qq.com/GetRoute',

    /** 相册列表URL */
    ALBUM_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3',

    /** 相册、相片评论列表URL */
    ALBUM_PHOTOS_COMMENTS_URL: 'https://user.qzone.qq.com/proxy/domain/app.photo.qzone.qq.com/cgi-bin/app/cgi_pcomment_xml_v2',

    /** 相片列表URL */
    IMAGES_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo',

    /** 相片详情URL */
    IMAGES_INFO_URL: 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_floatview_photo_list_v2',

    /** 好友列表URL */
    FRIENDS_LIST_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_show_qqfriends.cgi",

    /** 好友列表URL（排序） */
    FRIENDS_SORT_LIST_URL: "https://mobile.qzone.qq.com/friend/mfriend_list",

    /** 好友互动信息 */
    FRIENDSHIP_INFO_URL: "https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/friendship/cgi_friendship",

    /** 留言列表URL */
    BOARD_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb',

    /** 视频列表URL */
    VIDEO_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data',

    /** 我的收藏 */
    FAVORITE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/fav.qzone.qq.com/cgi-bin/get_fav_list',

    /** 分享列表 */
    SHARE_LIST_URL: 'https://user.qzone.qq.com/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzsharegetmylistbytype',

    /** 分享评论 */
    SHARE_COMMENTS_URL: 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshareget_comment',

    /** 点赞数目 */
    LIKE_COUNT_URL: 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/qz_opcnt2',

    /** 点赞列表 */
    LIKE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/users.qzone.qq.com/cgi-bin/likes/get_like_list_app',

    /** 好友互动消息列表URL（含已删除说说的通知，用于恢复已删除说说） */

    /** 说说、日志浏览记录列表 */
    VISITOR_SINGLE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_single',

    /** 相册浏览记录列表 */
    VISITOR_SIMPLE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_simple',

    /** 空间访问记录 */
    VISITOR_MORE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_more',

    /** 特别关心列表（含被关心个数） */
    SPECIAL_CARE_LIST_URL: 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/specialcare_get.cgi',

    /** 好友/用户名片（含昵称、备注、智能备注、是否特别关心、亲密度、共同好友、是否好友，是否开通空间，性别，城市） */
    USER_CARD_URL: 'https://h5.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/cgi_personal_card',

    /** 获取坐标地址信息 */
    MAP_LBS_INFO: 'https://apis.map.qq.com/ws/geocoder/v1',

    /** 转换坐标信息 */
    TO_TX_LBS: 'https://apis.map.qq.com/ws/coord/v1/translate'

};

// WeChat Emoji Datas
const emojis = [{ "index": 2002, "key": "Smirk", "cn": "[奸笑]", "en": "[Smirk]", "image": "2_02.png" }, { "index": 2004, "key": "Hey", "cn": "[嘿哈]", "en": "[Hey]", "image": "2_04.png" }, { "index": 2005, "key": "Facepalm", "cn": "[捂脸]", "en": "[Facepalm]", "image": "2_05.png" }, { "index": 2006, "key": "Smart", "cn": "[机智]", "en": "[Smart]", "image": "2_06.png" }, { "index": 2007, "key": "Tea", "cn": "[茶]", "en": "[Tea]", "image": "2_07.png" }, { "index": 2009, "key": "Packet", "cn": "[红包]", "en": "[Packet]", "image": "2_09.png" }, { "index": 2010, "key": "Candle", "cn": "[蜡烛]", "en": "[Candle]", "image": "2_10.png" }, { "index": 2011, "key": "Yeah!", "cn": "[耶]", "en": "[Yeah!]", "image": "2_11.png" }, { "index": 2018, "key": "Concerned", "cn": "[皱眉]", "en": "[Concerned]", "image": "2_12.png" }, { "index": 2013, "key": "Blush", "cn": "[囧]", "en": "[Blush]", "image": "smiley_17b.png" }, { "index": 2014, "key": "Salute", "cn": "[抱拳]", "en": "[Salute]", "image": "smiley_17b.png" }, { "index": 2015, "key": "Chick", "cn": "[鸡]", "en": "[Chick]", "image": "2_14.png" }, { "index": 2016, "key": "Blessing", "cn": "[福]", "en": "[Blessing]", "image": "2_15.png" }, { "index": 2017, "key": "Bye", "cn": "[再见]", "en": "[Bye]", "image": "smiley_39b.png" }, { "index": 2019, "key": "Rich", "cn": "[發]", "en": "[Rich]", "image": "2_16.png" }, { "index": 2020, "key": "Pup", "cn": "[小狗]", "en": "[Pup]", "image": "2_17.png" }, { "index": 2021, "key": "Onlooker", "cn": "[吃瓜]", "en": "[Onlooker]", "image": "Watermelon.png" }, { "index": 2022, "key": "GoForIt", "cn": "[加油]", "en": "[GoForIt]", "image": "Addoil.png" }, { "index": 2023, "key": "Sweats", "cn": "[汗]", "en": "[Sweats]", "image": "Sweat.png" }, { "index": 2025, "key": "OMG", "cn": "[天啊]", "en": "[OMG]", "image": "Shocked!.png" }, { "index": 2027, "key": "Emm", "cn": "[Emm]", "en": "[Emm]", "image": "Cold.png" }, { "index": 2028, "key": "Respect", "cn": "[社会社会]", "en": "[Respect]", "image": "Social.png" }, { "index": 2030, "key": "Doge", "cn": "[旺柴]", "en": "[Doge]", "image": "Yellowdog.png" }, { "index": 2034, "key": "NoProb", "cn": "[旺柴]", "en": "[NoProb]", "image": "NoProb.png" }, { "index": 2036, "key": "MyBad", "cn": "[打脸]", "en": "[MyBad]", "image": "Slap.png" }, { "index": 2037, "key": "Wow", "cn": "[哇]", "en": "[Wow]", "image": "Wow!.png" }, { "index": 2038, "key": "KeepFighting", "cn": "[哇]", "en": "[KeepFighting]", "image": "KeepFighting.png" }, { "index": 2043, "key": "Boring", "cn": "[翻白眼]", "en": "[Boring]", "image": "Boring.png" }, { "index": 2044, "key": "666", "cn": "[666]", "en": "[Awesome]", "image": "666.png" }, { "index": 2045, "key": "LetMeSee", "cn": "[让我看看]", "en": "[LetMeSee]", "image": "LetMeSee.png" }, { "index": 2046, "key": "Sigh", "cn": "[叹气]", "en": "[Sigh]", "image": "Sigh.png" }, { "index": 2047, "key": "Hurt", "cn": "[苦涩]", "en": "[Hurt]", "image": "Hurt.png" }, { "index": 2048, "key": "Broken", "cn": "[裂开]", "en": "[Broken]", "image": "Broken.png" }, { "index": 2049, "key": "Flushed", "cn": "[脸红]", "en": "[Flushed]", "image": "Flushed.png" }, { "index": 2050, "key": "Happy", "cn": "[笑脸]", "en": "[Happy]", "image": "Happy.png" }, { "index": 2051, "key": "Lol", "cn": "[破涕为笑]", "en": "[Lol]", "image": "Lol.png" }, { "index": 2052, "key": "Fireworks", "cn": "[烟花]", "en": "[Fireworks]", "image": "Fireworks.png" }, { "index": 2053, "key": "gift", "cn": "[礼物]", "en": "[Gift]", "image": "Gift.png" }, { "index": 2054, "key": "Party", "cn": "[庆祝]", "en": "[Party]", "image": "Party.png" }, { "index": 2055, "key": "Terror", "cn": "[恐惧]", "en": "[Terror]", "image": "Terror.png" }, { "index": 2056, "key": "Duh", "cn": "[恐惧]", "en": "[Duh]", "image": "Duh.png" }, { "index": 2057, "key": "LetDown", "cn": "[失望]", "en": "[Let Down]", "image": "Let Down.png" }, { "index": 2058, "key": "Sick", "cn": "[生病]", "en": "[Sick]", "image": "Sick.png" }, { "index": 2059, "key": "Worship", "cn": "[合十]", "en": "[Worship]", "image": "Worship.png" }];

// 表情转换实现
const emotionMap = {}
emojis.forEach((item, index) => {
    if (item.cn) {
        emotionMap[item.cn] = item
    }
    if (item.en) {
        emotionMap[item.en] = item
    }
})

/**
 * 转换微信新表情
 * @param {string} content 转换内容
 */
const parseEmoji = (content) => {
    let emojiIndexList = []
    for (const k in emotionMap) {
        let idx = content.indexOf(k)
        while (idx >= 0) {
            emojiIndexList.push({ idx, code: k, type: 2 })
            idx = content.indexOf(k, idx + k.length)
        }
    }

    emojiIndexList = emojiIndexList.sort((a, b) => {
        return a.idx - b.idx
    })
    const newContentList = []
    let lastTextIndex = 0
    emojiIndexList.forEach(item => {
        if (lastTextIndex !== item.idx) {
            newContentList.push({
                type: 1,
                content: content.substring(lastTextIndex, item.idx)
            })
        }
        if (item.type === 2) {
            newContentList.push({
                type: item.type,
                content: content.substr(item.idx, item.code.length),
                image: emotionMap[item.code].image
            })
        } else {
            newContentList.push({
                type: item.type,
                content: item.code,
                image: item.image
            })
        }
        lastTextIndex = item.idx + item.code.length
    })
    const lastText = content.substring(lastTextIndex)
    if (lastText) {
        newContentList.push({
            type: 1,
            content: lastText
        })
    }
    return newContentList;
}

