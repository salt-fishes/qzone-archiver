<script setup lang="ts">
/**
 * 检查更新（v5.5）：手动查询 GitHub Releases。
 * 只提示新版本并给出下载入口，不自动下载、不静默安装。
 */
import { computed, onMounted } from 'vue';
import { NAlert, NButton } from 'naive-ui';
import { useUpdateStore } from '../stores/update';

const update = useUpdateStore();

const title = computed(() => {
  if (update.checking) return '正在检查更新…';
  if (update.error) return '检查失败';
  if (update.info?.ok && update.info.hasUpdate) return `发现新版本 v${update.info.latest}`;
  if (update.info?.ok) return '已是最新版本';
  return '手动检查更新';
});

const desc = computed(() => {
  if (update.checking) return '正在连接 GitHub Releases，请稍候。';
  if (update.error) return '网络或 GitHub API 暂时不可用，可稍后重试或直接打开发布页。';
  if (update.info?.ok && update.info.hasUpdate) {
    return `当前版本 v${update.displayVersion}，建议下载新版本。`;
  }
  if (update.info?.ok) return `当前版本 v${update.displayVersion}，无需更新。`;
  return '检查 GitHub Releases 上是否有新版本；仅查询，不自动下载。';
});

const tone = computed(() => {
  if (update.checking) return 'is-checking';
  if (update.error) return 'is-error';
  if (update.info?.ok && update.info.hasUpdate) return 'is-new';
  if (update.info?.ok) return 'is-latest';
  return 'is-idle';
});

const lastChecked = computed(() =>
  update.checkedAt ? new Date(update.checkedAt).toLocaleString('zh-CN') : '尚未检查'
);

function formatSize(bytes?: number) {
  if (!bytes) return '';
  return `（${(bytes / 1024 / 1024).toFixed(1)} MB）`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN');
}

onMounted(() => {
  update.loadAppInfo();
});
</script>

<template>
  <section class="update-page">
    <header class="up-head">
      <div>
        <h1>检查更新</h1>
        <p class="up-lead">
          手动检查 GitHub Releases 上的最新版本。只提示、不自动下载，是否升级由你决定。
        </p>
      </div>
      <div class="ver-card">
        <span class="ver-label">当前版本</span>
        <strong class="ver-num">v{{ update.displayVersion }}</strong>
        <em v-if="update.platform" class="ver-meta">{{ update.platform }} · {{ update.arch }}</em>
      </div>
    </header>

    <div class="up-card">
      <div class="up-status" :class="tone">
        <span class="status-dot" />
        <div class="status-copy">
          <h2>{{ title }}</h2>
          <p>{{ desc }}</p>
        </div>
        <div class="status-actions">
          <NButton
            v-if="update.info?.ok && !update.info.hasUpdate"
            quaternary
            @click="update.open(update.info.url)"
          >
            查看发布页
          </NButton>
          <NButton
            type="primary"
            :loading="update.checking"
            @click="update.check()"
          >
            {{ update.info ? '重新检查' : '检查更新' }}
          </NButton>
        </div>
      </div>

      <div v-if="update.info?.ok && update.info.hasUpdate" class="up-release">
        <div class="release-head">
          <div>
            <h3>{{ update.info.name || `v${update.info.latest}` }}</h3>
            <p class="release-meta">
              最新版本 v{{ update.info.latest }}
              <span v-if="update.info.publishedAt"> · {{ formatDate(update.info.publishedAt) }}</span>
            </p>
          </div>
          <span class="tag-new">NEW</span>
        </div>

        <div class="up-actions">
          <NButton
            v-if="update.setupAsset"
            type="primary"
            @click="update.open(update.setupAsset.url)"
          >
            下载安装版{{ formatSize(update.setupAsset.size) }}
          </NButton>
          <NButton
            v-if="update.portableAsset"
            @click="update.open(update.portableAsset.url)"
          >
            下载免安装版{{ formatSize(update.portableAsset.size) }}
          </NButton>
          <NButton
            quaternary
            @click="update.open(update.info.url)"
          >
            打开 Release 页面
          </NButton>
        </div>

        <div v-if="update.info.notes" class="up-notes">
          <h4>更新内容</h4>
          <pre>{{ update.info.notes }}</pre>
        </div>
      </div>

      <NAlert
        v-if="update.error"
        type="error"
        :show-icon="true"
      >
        {{ update.error }}
      </NAlert>

      <p class="up-hint">
        上次检查：{{ lastChecked }}。若无法访问 GitHub API，可直接打开 Release 页面手动下载。
      </p>
    </div>

    <div class="up-guide">
      <h3>手动更新说明</h3>
      <ol>
        <li>检查更新只读取 GitHub Releases 的版本号与安装包列表，不会后台上传任何数据。</li>
        <li>发现新版本后，下载安装版覆盖安装即可；免安装版解压后替换旧目录。</li>
        <li>旧版档案与配置会保留，升级不会删除已备份的数据。</li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.update-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 12px;
}
.up-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.up-head h1 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 600;
}
.up-lead {
  margin: 0;
  max-width: 620px;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.7;
}
.ver-card {
  flex-shrink: 0;
  min-width: 150px;
  padding: 12px 16px;
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  background: var(--surface);
  text-align: right;
}
.ver-label {
  display: block;
  color: var(--ink-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
}
.ver-num {
  display: block;
  margin: 2px 0;
  font-family: var(--mono-font);
  font-size: 22px;
  font-weight: 600;
}
.ver-meta {
  color: var(--ink-muted);
  font-size: 11px;
  font-style: normal;
}
.up-card {
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background: var(--surface);
}
.up-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--surface-soft);
}
.status-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ink-muted);
}
.up-status.is-checking .status-dot {
  background: var(--indigo);
  animation: pulse 1.1s ease-in-out infinite;
}
.up-status.is-new .status-dot {
  background: var(--gold);
}
.up-status.is-latest .status-dot {
  background: var(--moss);
}
.up-status.is-error .status-dot {
  background: var(--vermilion);
}
.status-copy {
  flex: 1;
  min-width: 0;
}
.status-copy h2 {
  margin: 0 0 3px;
  font-size: 16px;
  font-weight: 600;
}
.status-copy p {
  margin: 0;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.6;
}
.status-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.up-release {
  margin-top: 18px;
}
.release-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.release-head h3 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}
.release-meta {
  margin: 0;
  color: var(--ink-muted);
  font-size: 12px;
}
.tag-new {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(201, 162, 39, 0.18);
  color: var(--gold);
  font-family: var(--mono-font);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.up-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0;
}
.up-notes {
  padding: 14px 16px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: var(--surface-soft);
}
.up-notes h4 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}
.up-notes pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--app-font);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink);
}
.up-hint {
  margin: 14px 0 0;
  color: var(--ink-muted);
  font-size: 11.5px;
  line-height: 1.6;
}
.up-guide {
  padding: 18px 20px;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background: var(--surface);
}
.up-guide h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.up-guide ol {
  margin: 0;
  padding-left: 20px;
  color: var(--ink-muted);
  font-size: 12.5px;
  line-height: 1.9;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
