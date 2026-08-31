/**
 * Statistics 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_STATISTICS = {

    /**
     * 获取GeoJson
     * @param {string} code 文件URL
     */
    getMapJson(code) {
        // 桌面端：主进程带 Referer 获取（等价扩展 background getMapJson）
        return window.QZonePlatform.network.getJson('https://geo.datav.aliyun.com/areas_v3/bound/' + code + '_full.json');
    },

    /**
     * 基于阿里云递归获取所有地图的JSON
     * @param {String}} code 编码
     */
    async getAllMapJson(code) {
        // 所有的地图的GeoJson，key为编码
        window.mapGeoJson = window.mapGeoJson || {};
        if (!code) {
            return window.mapGeoJson;
        }
        // 发送请求，存在跨域问题，在背景页发送
        await API.Statistics.getMapJson(code).then(async(data) => {

            // 指定编码的GeoJson
            window.mapGeoJson[code] = data;
            // 递归获取
            const features = data.features || [];
            for (const feature of features) {
                const properties = feature.properties || {};
                if (properties.level === 'district' || properties.childrenNum === 0) {
                    continue;
                }
                await API.Statistics.getAllMapJson(properties.adcode);
            }

        }).catch((e) => {
            console.error(code, e)
        })

        return window.mapGeoJson;
    },

    /**
     * 获取评论人
     * @param {Object} item 
     */
    getCommentUsers(item) {
        // 所有的用户
        const users = [];

        // 评论人
        const comments = item.custom_comments || item.comments || item.items || [];
        if (_.isEmpty(comments)) {
            return users;
        }
        // 遍历评论
        for (const comment of comments) {

            const commentUser = API.Common.getCommentUser(comment);

            if (commentUser.uin && !API.Common.isTargetUin(commentUser.uin) && _.findIndex(users, ['uin', comment.uin]) == -1) {
                users.push(commentUser);
            }

            // 回复
            const repList = comment.list_3 || comment.replies || comment.replyList || [];
            for (const repItem of repList) {

                const repUser = API.Common.getCommentUser(repItem);

                if (_.findIndex(users, ['uin', repItem.uin]) > -1) {
                    continue;
                }

                if (repUser.uin && !API.Common.isTargetUin(repUser.uin)) {
                    users.push(repUser);
                }
            }
        }
        return users;
    },

    /**
     * 获取点赞人
     * @param {Object} item 
     */
    getLikeUsers(item) {
        // 所有的用户
        const users = [];

        // 点赞人
        const likes = item.likes || [];

        if (_.isEmpty(likes)) {
            return users;
        }
        // 遍历点赞
        for (const like of likes) {

            const user = {
                uin: like.uin || like.fuin,
                name: like.name || like.nick
            }

            if (_.findIndex(users, ['uin', like.fuin]) > -1) {
                continue;
            }

            if (user.uin && !API.Common.isTargetUin(user.uin)) {
                users.push(user);
            }
        }
        return users;
    },

    /**
     * 获取浏览者
     * @param {Object} item 
     */
    getVisitorUsers(item) {
        // 所有的用户
        const users = [];

        // 访客
        const custom_visitors = item.custom_visitor && item.custom_visitor.list || [];
        if (_.isEmpty(custom_visitors)) {
            return users;
        }
        // 遍历
        for (const visitorItem of custom_visitors) {

            const user = {
                uin: visitorItem.uin || visitorItem.fuin,
                name: visitorItem.name || visitorItem.nick
            }

            if (_.findIndex(users, ['uin', visitorItem.uin]) > -1) {
                continue;
            }

            if (user.uin && !API.Common.isTargetUin(user.uin)) {
                users.push(user);
            }
        }

        return users;
    },

    /**
     * 收集互动用户
     */
    getInteractiveUsers(items, module) {
        //  所有的用户
        const users = [];

        if (_.isEmpty(items)) {
            return users;
        }

        for (const item of items) {
            // 评论人
            users.push(...this.getCommentUsers(item));
            // 点赞人
            users.push(...this.getLikeUsers(item));
            // 访客
            users.push(...this.getVisitorUsers(item));

            if (module === 'Messages') {
                // 转载说说原主人，不管备份内容是否体现，都备份下
                if (item.rt_tid && item.rt_uin && !API.Common.isTargetUin(item.rt_uin)) {
                    users.push({
                        uin: item.rt_uin,
                        name: item.rt_uinname
                    });
                }
            } else if (module === 'Blogs') {
                // 转载日志原主人，不管备份内容是否体现，都备份下
                if (item.orgblogid && item.orguin && !API.Common.isTargetUin(item.orguin)) {
                    users.push({
                        uin: item.orguin,
                        name: item.orgnick
                    });
                }
            } else if (module === 'Diaries') {
                // 转载日记原主人，不管备份内容是否体现，都备份下
                if (item.orgblogid && item.orguin && !API.Common.isTargetUin(item.orguin)) {
                    users.push({
                        uin: item.orguin,
                        name: item.orgnick
                    });
                }
            } else if (module === 'Favorites') {
                // 收藏的来源用户
                const user = API.Favorites.getFavoriteOwner(item);
                if (user.uin && !API.Common.isTargetUin(user.uin)) {
                    users.push(user);
                }
                // 收藏说说的原主人，不管备份内容是否体现，都备份下
                if (item.shuoshuo_info && item.shuoshuo_info.forward_flag && !API.Common.isTargetUin(item.shuoshuo_info.origin_uin)) {
                    users.push({
                        uin: item.shuoshuo_info.origin_uin,
                        name: item.shuoshuo_info.origin_name
                    });
                }
                // 收藏日志的原主人，不管备份内容是否体现，都备份下
                if (item.blog_info && item.blog_info.forward_flag && !API.Common.isTargetUin(item.blog_info.origin_uin)) {
                    users.push({
                        uin: item.blog_info.origin_uin,
                        name: item.blog_info.origin_name
                    });
                }
            } else if (module === 'Shares') {
                // 分享的来源用户，一般为自己
                if (item.uin && !API.Common.isTargetUin(item.uin)) {
                    users.push({
                        uin: item.uin,
                        name: item.nickname
                    });
                }
            } else if (module === 'Visitors') {
                // 访客
                if (item.uin && !API.Common.isTargetUin(item.uin)) {
                    users.push({
                        uin: item.uin,
                        name: item.nickname
                    });
                }
                // 其他访客
                if (item.uins) {
                    users.push(...item.uins);
                }
            }
        }
        return _.uniqBy(users, 'uin');
    },

    /**
     * 获取所有的互动用户
     * @returns 
     */
    getAllInteractiveUsers() {

        // 获取所有的互动用户
        const users = [];

        // 说说互动用户
        users.push(...this.getInteractiveUsers(QZone.Messages.Data, 'Messages'));

        // 日志互动用户
        users.push(...this.getInteractiveUsers(QZone.Blogs.Data, 'Blogs'));

        // 日记互动用户
        users.push(...this.getInteractiveUsers(QZone.Diaries.Data, 'Diaries'));

        // 相册互动用户
        users.push(...this.getInteractiveUsers(QZone.Photos.Album.Data, 'Favorites'));

        // 相片互动用户
        users.push(...this.getInteractiveUsers(_.flatMap(QZone.Photos.Album.Data || [], item => item.photoList || [])));

        // 视频互动用户
        users.push(...this.getInteractiveUsers(QZone.Videos.Data));

        // 留言互动用户
        users.push(...this.getCommentUsers(QZone.Boards.Data));

        // 收藏互动用户
        users.push(...this.getInteractiveUsers(QZone.Favorites.Data, 'Favorites'));

        // 分享互动用户
        users.push(...this.getInteractiveUsers(QZone.Shares.Data, 'Shares'));

        // 访客互动用户
        users.push(...this.getInteractiveUsers(QZone.Visitors.Data.items, 'Visitors'));

        console.debug('收集到的互动用户', _.uniqBy(users, 'uin'));

        return _.uniqBy(users, 'uin');
    }
};
