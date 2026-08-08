/**
 * 分享标准化（P3，迁移自 api.js API.Shares.convert）
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.Shares = {
  /**
   * 转换分享网页到数据
   * @param {String} html 分享页面内容
   */
  convert(html) {
    const shareData = new ShareData();
    if (!html) {
        return shareData;
    }
    // 转换到JQuery对象
    const $sharePage = jQuery(html);
    const shares = $sharePage.find('#shares > li') || [];
    // 总数
    const $total = $($sharePage.find('#app_mod > div.wrap > div.aside.col_lar.bg3 > div.mod_info.bg > div.mod_conts > p'));
    shareData.total = $total && $total.text().replace('条分享', '') * 1 || 0;
    // 当前页
    const currentPage = $($sharePage.find('#app_mod > div.page_wrap > div > p.mod_pagenav_main > span > span > span')).text();

    console.info('分析分享列表中，当前页：%s，条目数：%d，总条目数：%s', currentPage, shares.length, shareData.total);

    const dataList = [];
    for (const li of shares) {
        const $li = $(li);
        const $infoDiv = $($li.find('div.mod_info.bbor3.__item_main__'));
        if (!$infoDiv) {
            continue;
        }

        $li.find('script').each(function() {
            const text = $(this).text();
            if (text.indexOf('shareInfos.push') > -1) {
                eval('window.infoJson=' + /[\s\S]+shareInfos.push\((\{[\s\S]+\})\);[\s\S]+/.exec(text)[1]);
                return false;
            }
        })

        // 分享显示区
        const $contentDiv = $($infoDiv.find('div.mod_conts._share_desc_cont'));
        // 分享描述
        const $temp_desc = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming'));
        // 分享审核中
        const isReviewing = $temp_desc && $temp_desc.text() === '此条分享正在审核中';
        if (!window.infoJson || !window.infoJson.ugcPlatform || window.infoJson.ugcPlatform === '' || isReviewing) {
            continue;
        }

        // 分享源
        // 标题
        const $targetLink = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > h5 > strong > a.c_tx._share_title'));
        const title = $targetLink && $targetLink.html() || '';
        // 描述
        const $desc = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p:not(.mod_music,.c_tx3.comming)'));
        const desc = $desc && $desc.html() || '';
        // URL
        let url = $targetLink && $targetLink.attr('href') || '#';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = "https://user.qzone.qq.com/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/" + url;
        }
        // 分享次数
        const $share_count = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p > span.share_count'));
        const count = $share_count && $share_count.text() || 0;
        // 分享来源URL
        const $fromLink = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > p.c_tx3.comming > a.c_tx3.mgrm'));
        const fromUrl = $fromLink && $fromLink.attr('href') || '#';
        let fromName = $fromLink && $fromLink.text() || '';
        fromName = API.Shares.getSourceType(fromUrl, fromName);
        // 配图
        const images = [];
        // 左图右文的图
        const $normal_images = $($contentDiv.find('div.mod_details.lbor > div.layout_s img')) || [];
        if ($normal_images) {
            $normal_images.each(function() {
                images.push({
                    url: $(this).attr('src') || $(this).attr('data-src')
                });
            });
        }
        // 相册、相片的图
        const $album_images = $($contentDiv.find('div.mod_details.lbor > div.mod_brief > div.mod_list > ul > li img')) || [];
        if ($album_images) {
            $album_images.each(function() {
                images.push({
                    url: $(this).attr('src') || $(this).attr('data-src')
                });
            });
        }
        const shareSource = new ShareSource(title, desc, url, fromUrl, fromName, count * 1, images);

        // 分享时间
        const $shareTime = $($contentDiv.find('div.c_tx3.mod_scraps > span:nth-child(1)'));

        let shareTime = $shareTime && $shareTime.text() || '1970-01-01';

        const poster = infoJson.poster || {};
        const shareInfo = new ShareInfo(infoJson.id, poster.uin, poster.nickname, infoJson.type, infoJson.memo, shareSource, API.Utils.toDate(shareTime).getTime() / 1000);
        // 评论数
        const $commentCount = $($contentDiv.find('#' + li.id + '_commentCount'));
        shareInfo.commentTotal = $commentCount && $commentCount.text() * 1 || 0;
        // 点赞数
        const $likeTotal = $($contentDiv.find('div.c_tx3.mod_scraps > span.mgrs.like_count.right > span > a:nth-child(3)'));
        const likeTotal = $likeTotal && /赞\((\d)\)/.exec($likeTotal.text()) && /赞\((\d)\)/.exec($likeTotal.text())[1] || 0;
        shareInfo.likeTotal = likeTotal * 1;
        dataList.push(shareInfo);
    }
    shareData.list = dataList;
    return shareData;
  }
};
