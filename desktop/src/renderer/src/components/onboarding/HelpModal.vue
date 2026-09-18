<script setup lang="ts">
/** 帮助中心（v4.6 重写：新手教程 / 常见问题 / 隐私政策 + 内置教程入口） */
import { NModal, NTabs, NTabPane, NButton } from 'naive-ui';
import { useRouter } from 'vue-router';

const show = defineModel<boolean>('show', { default: false });
const emit = defineEmits<{ tour: [] }>();
const router = useRouter();

/** 内置使用教程 */
function openTutorial() {
  show.value = false;
  router.push('/tutorial');
}
</script>

<template>
  <NModal
    v-model:show="show"
    :auto-focus="false"
  >
    <div class="help">
      <h3>帮助与隐私</h3>
      <div class="help-links">
        <NButton
          size="tiny"
          quaternary
          type="primary"
          @click="emit('tour')"
        >
          重新查看应用内教程
        </NButton>
        <NButton
          size="tiny"
          quaternary
          @click="openTutorial"
        >
          图文使用教程
        </NButton>
      </div>
      <NTabs
        type="line"
        animated
        display-directive="show:lazy"
      >
        <NTabPane
          name="guide"
          tab="新手教程"
        >
          <ol class="guide">
            <li>点击顶栏「扫码登录」，在弹出的窗口中使用 QQ 扫码。</li>
            <li>进入「新建任务」，选择备份内容与保存位置。</li>
            <li>开始后可随时暂停/恢复；完成后双击档案目录中的 <code>index.html</code> 离线浏览。</li>
            <li>再次备份时选择增量方式「上次（只备份新增）」，速度更快。</li>
          </ol>
        </NTabPane>
        <NTabPane
          name="faq"
          tab="常见问题"
        >
          <dl class="faq">
            <dt>备份好友空间需要什么条件？</dt>
            <dd>选择「访问空间」并输入对方 QQ 号即可；仅能采集对方公开或对登录者可见的内容，日记、收藏等私密内容无法备份。</dd>
            <dt>为什么相册下载的是加密图片？</dt>
            <dd>对方设置了权限的相册无法取得原图，属于正常现象；失败相册会在日志中说明。</dd>
            <dt>备份会不会影响我的账号？</dt>
            <dd>应用按正常浏览节奏访问，内置重试与风控等待；备份好友空间会像普通访问一样留下访客记录。</dd>
            <dt>下载速度慢？</dt>
            <dd>可在「设置 → 通用」调整下载并发与间隔；也可在高级中选择 Aria2 / 迅雷下载方式。</dd>
          </dl>
        </NTabPane>
        <NTabPane
          name="privacy"
          tab="隐私政策"
        >
          <div class="privacy">
            <p>本应用为完全本地化工具：</p>
            <ul>
              <li>不接入任何第三方服务器，所有采集请求由本机直接发往 QQ 空间官方接口；</li>
              <li>登录凭证（Cookie）仅保存在本机应用数据目录，用于维持登录状态；</li>
              <li>备份产物全部保存在你指定的本地文件夹，可随时删除；</li>
              <li>不收集、不上传、不分析任何用户数据。</li>
            </ul>
          </div>
        </NTabPane>
      </NTabs>
    </div>
  </NModal>
</template>

<style scoped>
.help {
  width: 560px;
  max-width: calc(100vw - 60px);
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 16px;
  padding: 22px 26px 26px;
  background: var(--surface);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
.help h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.help-links {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.guide {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 2;
}
.faq {
  margin: 0;
  font-size: 13px;
}
.faq dt {
  font-weight: 600;
  margin-top: 12px;
}
.faq dd {
  margin: 4px 0 0;
  line-height: 1.7;
  opacity: 0.7;
}
.privacy {
  font-size: 13px;
  line-height: 1.9;
}
.privacy p {
  margin: 0 0 6px;
}
.privacy ul {
  margin: 0;
  padding-left: 18px;
  opacity: 0.75;
}
code {
  font-family: var(--mono-font);
  font-size: 12px;
}
</style>
