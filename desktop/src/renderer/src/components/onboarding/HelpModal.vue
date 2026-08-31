<script setup lang="ts">
/** 帮助中心模态（P4.3 自 App.vue 拆出）：新手教程 / 常见问题 / 隐私政策 三页签 */
const props = defineProps<{ show: boolean; tab: 'guide' | 'faq' | 'privacy' }>();
const emit = defineEmits<{
  (e: 'update:tab', tab: 'guide' | 'faq' | 'privacy'): void;
  (e: 'close'): void;
}>();

function setTab(t: 'guide' | 'faq' | 'privacy') {
  emit('update:tab', t);
}
</script>

<template>
  <div
    v-if="props.show"
    class="overlay"
    @click.self="emit('close')"
  >
    <div class="help">
      <div class="settings-head">
        <h3 class="settings-title">
          帮助中心
        </h3>
        <button
          class="btn ghost sm"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
      <div class="settings-body">
        <nav class="settings-tabs">
          <button
            class="tab-btn"
            :class="{ active: props.tab === 'guide' }"
            @click="setTab('guide')"
          >
            新手教程
          </button>
          <button
            class="tab-btn"
            :class="{ active: props.tab === 'faq' }"
            @click="setTab('faq')"
          >
            常见问题
          </button>
          <button
            class="tab-btn"
            :class="{ active: props.tab === 'privacy' }"
            @click="setTab('privacy')"
          >
            隐私政策
          </button>
        </nav>
        <div class="settings-content help-content">
          <template v-if="props.tab === 'guide'">
            <h4>第一步：登录</h4>
            <p>点击右上角「扫码登录」，用手机 QQ 扫描二维码授权。登录态保存在应用本地，下次启动无需重复登录。</p>
            <h4>第二步：选择备份内容</h4>
            <p>在左侧勾选需要备份的模块。每个模块的备份类型（网页版 / 单文件网页 / 文本 / 原始数据）与获取选项（评论 / 赞 / 访客等）可在「设置」中调整。</p>
            <h4>第三步：开始备份</h4>
            <p>选择保存位置后点击「开始备份」。助手会逐模块采集数据，并将说说配图、相册原图、视频等多媒体下载到目标目录，采集过程可查看进度与日志。</p>
            <h4>第四步：浏览备份</h4>
            <p>备份完成后打开目标目录，双击 <code>index.html</code> 即可离线浏览。产物完全本地化，不依赖网络。</p>
            <h4>增量备份</h4>
            <p>在设置中将模块的「增量备份」改为「上次」，再次备份时只采集新增内容，可显著加快备份速度。</p>
            <h4>备份建议</h4>
            <p>首次备份建议先备份数据量较少的模块熟悉流程；数据量大时适当调大「查询间隔」与「重试次数」，避免触发限流。</p>
          </template>

          <template v-else-if="props.tab === 'faq'">
            <h4>如何备份别人的 QQ 空间？</h4>
            <p>先登录自己的 QQ 空间，再访问对方的空间（需有访问权限），然后选择备份即可。备份会在对方访客记录中留下访问痕迹。</p>
            <h4>备份文件保存在哪里？</h4>
            <p>保存在你选择的「保存位置」目录下，其中的 <code>index.html</code> 是浏览入口。</p>
            <h4>为什么有些数据没有备份到？</h4>
            <p>评论、赞默认开启，可在「设置 → 对应模块」中关闭；最近访问默认关闭，需要时在模块设置中打开。请求间隔过短或数据量过大时也可能触发限流导致部分跳过。</p>
            <h4>相册下载的是原图吗？</h4>
            <p>开启「相册 → 获取图片详情」后下载原图；默认只下载预览图以节省时间与流量。</p>
            <h4>备份是否会导致账号异常？</h4>
            <p>助手模拟正常浏览行为，但过于频繁的备份可能触发安全风控。建议查询间隔保持默认，不要短时间重复备份。</p>
            <h4>迅雷无法唤起下载？</h4>
            <p>确认已安装迅雷，并在「公共设置」中检查迅雷任务数与唤起间隔配置。</p>
            <h4>Aria2 / Motrix 无法添加任务？</h4>
            <p>确认 RPC 服务已启用，并在「公共设置」中填写正确的 RPC 地址与密钥。</p>
            <h4>能否导出加密空间或私密相册？</h4>
            <p>仅能导出你有访问权限或公开的数据，没有权限的内容无法备份。</p>
          </template>

          <template v-else>
            <h4>我们如何收集你的信息</h4>
            <p>应用仅在你授权登录后，使用你的 QQ 登录态访问 QQ 空间，收集你选择的备份内容（说说、日志、相册等）数据。</p>
            <h4>我们如何使用你的信息</h4>
            <p>所有数据仅在本地处理：备份产物写入你选择的目录，登录态保存在应用本地。应用不上传、不分享、不出售任何你的数据。</p>
            <h4>数据的保存与清除</h4>
            <p>备份产物保存在你指定的目录，删除该目录即彻底清除；退出登录可清除应用本地的登录态。</p>
            <h4>第三方下载工具</h4>
            <p>使用迅雷 / Aria2 等第三方工具下载媒体文件时，文件经第三方工具处理；由此产生的数据流转不受本应用控制。</p>
            <h4>责任说明</h4>
            <p>请勿将他人空间的私密数据导出后传播。因导出或传播他人数据导致的隐私泄露，由使用者自行承担。</p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(50, 40, 28, 0.5);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 36px 16px; z-index: 100;
}
.settings-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px 12px;
}
.settings-title {
  margin: 0; font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  color: var(--accent-deep); font-size: 16px; letter-spacing: 1px;
}
.settings-body { display: flex; flex: 1; min-height: 0; }
.settings-tabs {
  width: 110px; flex-shrink: 0; padding: 4px 8px 12px;
  border-right: 1px solid var(--line-soft); overflow: auto;
  display: flex; flex-direction: column; gap: 2px;
}
.tab-btn {
  border: none; background: none; padding: 7px 10px; border-radius: var(--radius-sm);
  font-size: 13px; color: var(--ink-soft); cursor: pointer; text-align: left;
  font-family: inherit; transition: background 0.15s ease, color 0.15s ease;
}
.tab-btn:hover { background: var(--line-soft); color: var(--ink); }
.tab-btn.active { background: var(--accent); color: #fbe9d8; font-weight: 600; }
.settings-content { flex: 1; min-width: 0; overflow: auto; padding: 14px 18px 18px; }
.help {
  background: var(--card); border-radius: 12px; width: 100%; max-width: 760px;
  max-height: calc(100vh - 72px); overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 12px 44px rgba(40, 30, 15, 0.3); animation: fadeUp 0.3s ease both;
}
.help-content h4 {
  margin: 18px 0 6px; font-size: 13.5px; color: var(--accent-deep); font-weight: 700;
}
.help-content h4:first-child { margin-top: 0; }
.help-content p { margin: 0 0 4px; font-size: 13px; color: var(--ink); line-height: 1.75; }
.help-content code {
  font-family: Consolas, monospace; font-size: 12px; background: #efe3c6;
  border: 1px solid #e0d0a8; border-radius: 4px; padding: 0 5px; color: var(--accent-deep);
}
</style>
