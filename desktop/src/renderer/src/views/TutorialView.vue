<script setup lang="ts">
/**
 * 内置使用教程（v4.6）：左侧目录 + 右侧图文正文
 * 内容自写，参考 README / CODE_WIKI / 帮助中心资料；页面内的外链仅作延伸参考
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

/** 外链延伸参考（GitHub 仓库） */
function openRepo() {
  window.api.app.openExternal('https://github.com/salt-fishes/qzone-archiver#readme');
}

const SECTIONS = [
  { id: 'quick-start', label: '快速上手' },
  { id: 'login', label: '登录说明' },
  { id: 'wizard', label: '新建备份任务' },
  { id: 'modules', label: '可备份的内容' },
  { id: 'other-user', label: '备份好友空间' },
  { id: 'after-backup', label: '备份完成之后' },
  { id: 'download', label: '下载方式怎么选' },
  { id: 'increment', label: '增量备份' },
  { id: 'faq', label: '常见问题' },
  { id: 'privacy', label: '隐私与安全' },
];

const active = ref('quick-start');
let scrollBox: HTMLElement | null = null;

function onScroll() {
  if (!scrollBox) return;
  const boxTop = scrollBox.getBoundingClientRect().top;
  let current = SECTIONS[0].id;
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id);
    if (el && el.getBoundingClientRect().top - boxTop <= 140) current = s.id;
  }
  active.value = current;
}

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  active.value = id;
}

onMounted(() => {
  scrollBox = (window as any).__appScrollBox || document.querySelector('.app-content');
  scrollBox?.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => {
  scrollBox?.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <section class="tutorial">
    <!-- 目录 -->
    <aside class="toc app-scroll">
      <div class="toc-title">
        使用教程
      </div>
      <button
        v-for="s in SECTIONS"
        :key="s.id"
        class="toc-item"
        :class="{ active: active === s.id }"
        @click="go(s.id)"
      >
        {{ s.label }}
      </button>
    </aside>

    <!-- 正文 -->
    <article class="doc app-scroll">
      <h1>空间档案备份 · 使用教程</h1>
      <p class="lead">
        把 QQ 空间里的说说、相册、日志等记忆完整备份到自己的电脑，备份产物双击即可离线浏览，不依赖任何服务器。
      </p>

      <h2 id="quick-start">
        快速上手
      </h2>
      <p>只需三步，完成第一次备份：</p>
      <ol class="steps">
        <li>
          <b>扫码登录</b>——点右上角「扫码登录」，在弹出的窗口中用手机 QQ 扫码。
        </li>
        <li>
          <b>新建任务</b>——左侧进入「新建任务」，选好要备份的内容和保存位置。
        </li>
        <li>
          <b>开始备份</b>——点击开始后可随时暂停/恢复；完成后进入「我的档案」离线浏览。
        </li>
      </ol>
      <div class="tip">
        首次使用建议先备份「说说 + 相册」两个最常回顾的内容，跑通流程后再做全量备份。
      </div>

      <h2 id="login">
        登录说明
      </h2>
      <ul>
        <li>登录使用的是 QQ 官方扫码页面，应用拿到的只是本机浏览所需的 Cookie，<b>不会上传到任何第三方</b>。</li>
        <li>登录状态长期有效；如果提示未登录，点右上角重新扫码即可。</li>
        <li>备份好友空间也用<b>你自己的账号</b>登录——应用以"你的身份"去访问对方公开的内容。</li>
      </ul>

      <h2 id="wizard">
        新建备份任务
      </h2>
      <p>「新建任务」是一个三步向导：</p>
      <h3>第①步 · 备份谁的空间</h3>
      <ul>
        <li><b>我的空间</b>——备份登录账号的全部内容（含日记、收藏等私密内容）。</li>
        <li><b>好友的空间</b>——输入对方 QQ 号或从好友列表选择，备份其公开内容。选好后点「校验」确认对方空间可访问。</li>
      </ul>
      <h3>第②步 · 选择内容</h3>
      <p>
        10 类内容按卡片勾选，鼠标放到卡片下方可以看到上次备份的条数参考。备份好友空间时，日记、好友、收藏三项仅本人可见，会自动置灰。
      </p>
      <h3>第③步 · 保存位置</h3>
      <p>
        选择备份产物存放的文件夹。之后每次备份的增量都会存进同一目录；确认页会显示备份方式和数据量参考，点「开始备份」即启动。
      </p>
      <div class="tip">
        备份进行中可以随时暂停、恢复或取消；进度、下载明细、运行日志都可以在任务面板中查看。
      </div>

      <h2 id="modules">
        可备份的内容
      </h2>
      <table>
        <thead>
          <tr>
            <th>内容</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>说说</td><td>含配图、评论、点赞；可恢复部分已删除说说</td></tr>
          <tr><td>日志</td><td>长文与插图</td></tr>
          <tr><td>日记</td><td>仅本人可见（好友空间不可备份）</td></tr>
          <tr><td>相册</td><td>原图 + 预览图，可按相册挑选</td></tr>
          <tr><td>视频</td><td>空间视频文件</td></tr>
          <tr><td>留言</td><td>留言板内容</td></tr>
          <tr><td>好友</td><td>好友列表与分组（仅本人可见）</td></tr>
          <tr><td>收藏</td><td>收藏内容（仅本人可见）</td></tr>
          <tr><td>分享</td><td>转发分享记录</td></tr>
          <tr><td>访客</td><td>最近访客记录</td></tr>
        </tbody>
      </table>
      <p>
        每类内容可独立选择备份格式：<b>网页版</b>（推荐，可直接离线浏览）/ 单文件网页 / 文本 / 原始数据，在「设置 → 内容默认设置」中调整。
      </p>

      <h2 id="other-user">
        备份好友空间
      </h2>
      <ul>
        <li>只能备份<b>对方公开的、或对你的账号可见</b>的内容；对方设置了权限的相册会下载失败，日志中会说明。</li>
        <li>日记、收藏、好友列表属于本人隐私，任何情况下都不会采集。</li>
        <li>备份好友空间和普通访问一样，<b>会在对方的访客记录里留下你的足迹</b>，请尊重他人隐私、合理使用。</li>
        <li>建议保持默认的下载并发与间隔，访问节奏越接近正常浏览，越不容易被官方限制。</li>
      </ul>

      <h2 id="after-backup">
        备份完成之后
      </h2>
      <ul>
        <li><b>离线浏览</b>——「我的档案」里点「浏览」，或直接双击备份目录中的 <code>index.html</code>；支持按年份归档、全文搜索、图片/视频画廊。</li>
        <li><b>压缩分享</b>——点「压缩」在同级目录生成 .zip，方便转移到其他电脑。</li>
        <li><b>再次备份</b>——增量方式选「上次（只备份新增）」，只拉新内容，速度很快。</li>
      </ul>

      <h2 id="download">
        下载方式怎么选
      </h2>
      <table>
        <thead>
          <tr>
            <th>方式</th>
            <th>适合场景</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>应用内下载（默认）</td><td>绝大多数情况，无需任何配置</td></tr>
          <tr><td>Aria2 / Motrix</td><td>大量图片视频、本机已装 Aria2 时更稳定</td></tr>
          <tr><td>迅雷</td><td>习惯用迅雷接管下载的用户</td></tr>
        </tbody>
      </table>
      <p>具体参数（并发数、间隔、RPC 地址等）在「设置 → 通用」中调整，每一项都有问号说明。</p>

      <h2 id="increment">
        增量备份
      </h2>
      <p>
        每类内容可独立选择增量方式：<b>全量</b>（从头备份）、<b>上次</b>（只备份上次之后的新内容，并累积全部历史）、<b>自定义</b>（从指定时间开始）。首次全量备份后，日常建议用「上次」，几分钟即可同步新动态。
      </p>

      <h2 id="faq">
        常见问题
      </h2>
      <dl class="faq">
        <dt>备份到一半提示「操作频繁」？</dt>
        <dd>应用会自动等待并重试（默认最多 2 次、每次等 1 小时）。着急的话可以取消后稍晚继续，已下载的文件会保留。</dd>
        <dt>好友列表加载失败？</dt>
        <dd>通常是未登录或接口临时限制，点「重新加载」重试；具体原因会显示在下拉框下方。</dd>
        <dt>相册里下到打不开的加密图？</dt>
        <dd>对方设置了权限的相册拿不到原图。备份好友空间时请确保「获取图片详情」开启（默认已开）。</dd>
        <dt>换电脑怎么迁移？</dt>
        <dd>把备份文件夹整体拷贝过去即可，档案是纯静态文件；应用配置可在「设置 → 高级」导出/导入。</dd>
        <dt>下载速度慢？</dt>
        <dd>可在「设置 → 通用」适当调大并发数；大量媒体文件建议改用 Aria2。</dd>
      </dl>

      <h2 id="privacy">
        隐私与安全
      </h2>
      <ul>
        <li>应用不接入任何自有服务器：采集请求由本机直接发往 QQ 空间官方接口。</li>
        <li>登录凭证（Cookie）仅保存在本机应用数据目录，仅用于维持登录状态。</li>
        <li>备份产物全部在你指定的本地文件夹，可随时删除；删除应用不影响已备份数据。</li>
      </ul>

      <p class="foot-note">
        更多背景资料：<a
          href="javascript:void(0)"
          class="ext"
          @click="openRepo"
        >GitHub 仓库</a> · 本教程随应用内置，可离线查看。
      </p>
    </article>
  </section>
</template>

<style scoped>
.tutorial {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}
/* 目录 */
.toc {
  position: sticky;
  top: 0;
  width: 150px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: calc(100vh - 130px);
  overflow-y: auto;
}
.toc-title {
  font-size: 13px;
  font-weight: 700;
  padding: 6px 10px 8px;
}
.toc-item {
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  color: inherit;
  opacity: 0.6;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.toc-item:hover {
  opacity: 1;
  background: var(--surface-soft);
}
.toc-item.active {
  opacity: 1;
  background: rgba(180, 95, 61, 0.12);
  color: #b45f3d;
  font-weight: 600;
}
/* 正文 */
.doc {
  flex: 1;
  min-width: 0;
  max-width: 720px;
  line-height: 1.85;
  font-size: 13.5px;
  padding-bottom: 40px;
}
.doc h1 {
  font-size: 22px;
  margin: 0 0 6px;
}
.lead {
  margin: 0 0 26px;
  font-size: 13.5px;
  opacity: 0.6;
}
.doc h2 {
  font-size: 17px;
  margin: 34px 0 12px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
  scroll-margin-top: 20px;
}
.doc h3 {
  font-size: 14px;
  margin: 18px 0 8px;
}
.doc p {
  margin: 0 0 10px;
}
.doc ul,
.doc ol {
  margin: 0 0 12px;
  padding-left: 20px;
}
.doc li {
  margin-bottom: 6px;
}
.steps li {
  margin-bottom: 10px;
}
.tip {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(180, 95, 61, 0.08);
  border-left: 3px solid #b45f3d;
  font-size: 12.5px;
  margin: 12px 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 14px;
  font-size: 13px;
}
th,
td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
}
th {
  font-weight: 600;
  opacity: 0.6;
  font-size: 12px;
}
.faq dt {
  font-weight: 600;
  margin-top: 12px;
}
.faq dd {
  margin: 4px 0 0;
  opacity: 0.7;
}
code {
  font-family: var(--mono-font);
  font-size: 12px;
  background: var(--surface-soft);
  padding: 1px 5px;
  border-radius: 4px;
}
.foot-note {
  margin-top: 30px;
  font-size: 12px;
  opacity: 0.5;
}
.ext {
  color: #b45f3d;
  cursor: pointer;
}
@media (max-width: 860px) {
  .toc {
    display: none;
  }
}
</style>
