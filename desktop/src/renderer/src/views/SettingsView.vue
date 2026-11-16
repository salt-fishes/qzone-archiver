<script setup lang="ts">
/**
 * 设置（v4.6 精简重写）：通用 / 内容默认设置 / 相册选择 / 高级
 * 全部数据源为 config store（settings + albums），自动保存；schema 由 config-spec.json 生成
 */
import { ref, computed, onMounted } from 'vue';
import {
  NTabs, NTabPane, NCollapse, NCollapseItem, NButton, NSelect, NAlert, NInput,
  useDialog, useMessage,
} from 'naive-ui';
import { useConfigStore, MODULE_META, MODULE_KEYS } from '../stores/config';
import { COMMON_SCHEMA, MODULE_SCHEMA, DEV_SCHEMA } from '../stores/schema';
import { useAppearanceStore } from '../stores/appearance';
import { useBackupStore } from '../stores/backup';
import { useUpdateStore } from '../stores/update';
import SettingItems from '../components/settings/SettingItems.vue';
import UpdatePanel from '../components/settings/UpdatePanel.vue';

const cfg = useConfigStore();
const appearance = useAppearanceStore();
const bk = useBackupStore();
const update = useUpdateStore();
const dialog = useDialog();
const message = useMessage();

const REPO_URL = 'https://github.com/salt-fishes/qzone-archiver';
const RELEASES_URL = 'https://github.com/salt-fishes/qzone-archiver/releases';
const LICENSE_URL = 'https://github.com/salt-fishes/qzone-archiver/blob/main/LICENSE';

function openLink(url: string) {
  window.api.app.openExternal(url);
}

const themeOptions = [
  { label: '跟随系统（自动切换深浅色）', value: 'auto' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];

/* -------- 检查更新：统一收口在「关于与更新」tab（UpdatePanel） -------- */

/* -------- 日志（v4.9 §K） -------- */
function openLogsDir() {
  window.api.app.openLogs();
}

/* -------- 相册选择 -------- */
const albumOptions = ref<{ type: string; label: string; children?: { label: string; value: string }[] }[]>([]);
const albumSelectLoading = ref(false);

/** 相册选择提示文案（无权限相册单独说明） */
const albumHint = computed(() => {
  const noAccess = cfg.albumsNoAccess.length;
  const extra = noAccess ? `${noAccess} 个相册无权限访问（已置灰，备份时自动跳过）；` : '';
  return `已选 ${cfg.albumSel.length} / ${cfg.selectableAlbumIds.length} 个相册；${extra}不选择任何相册时备份全部。`;
});

async function loadAlbumsForSelect() {
  if (albumSelectLoading.value) return;
  albumSelectLoading.value = true;
  cfg.albumError = '';
  await cfg.loadAlbums();
  // 分组选项：分类分组（可备份）+「无权限」单独一组（置灰不可选，备份时会跳过采集）
  const groups = cfg.albumClassNames.map((g) => ({
    type: 'group',
    label: g.cls,
    key: g.cls,
    children: g.items.map((a) => ({
      label: `${a.name}${a.total != null ? `（${a.total}）` : ''}`,
      value: String(a.id),
      disabled: a.allowAccess === 0,
    })),
  }));
  const noAccess = cfg.albumsNoAccess;
  if (noAccess.length) {
    groups.push({
      type: 'group',
      label: '无权限（不可备份）',
      key: '__noaccess__',
      children: noAccess.map((a) => ({
        label: `${a.name}（无权限访问）`,
        value: String(a.id),
        disabled: true,
      })),
    });
  }
  albumOptions.value = groups as any;
  albumSelectLoading.value = false;
}

onMounted(() => {
  // 相册列表按需加载（进入该页时预取，登录后有效）
  if (!cfg.albums.length) loadAlbumsForSelect();
  update.loadAppInfo();
});

/* -------- 配置管理 -------- */
function confirmReset() {
  dialog.warning({
    title: '恢复默认设置？',
    content: '全部引擎设置将恢复为默认值，备份历史与档案文件不受影响。',
    positiveText: '恢复默认',
    negativeText: '取消',
    onPositiveClick: async () => {
      const r = await window.api.config.reset();
      if (r?.ok) {
        await cfg.initConfig();
        message.success('已恢复默认设置');
      } else {
        message.error(r?.error || '重置失败');
      }
    },
  });
}

async function importConfig() {
  const r = await window.api.config.import();
  if (r?.ok) {
    await cfg.initConfig();
    message.success('配置导入成功');
  } else if (r?.error !== 'canceled') {
    message.error(r?.error || '导入失败');
  }
}

async function exportConfig() {
  const r = await window.api.config.export();
  if (r?.ok && r.path) message.success(`已导出到 ${r.path}`);
  else if (r?.error && r.error !== 'canceled') message.error(r.error);
}
</script>

<template>
  <section class="settings">
    <div class="st-head">
      <h2>设置</h2>
      <p>改动自动保存；引擎设置在下次备份时生效</p>
    </div>

    <NTabs
      type="line"
      class="st-tabs"
    >
      <NTabPane
        name="general"
        tab="通用"
      >
        <div class="st-card">
          <div class="st-block">
            <h4>外观</h4>
            <NSelect
              :value="appearance.theme"
              :options="themeOptions"
              size="small"
              class="ctl"
              @update:value="(v) => appearance.setTheme(v as 'auto' | 'light' | 'dark')"
            />
          </div>
          <div class="st-block">
            <h4>下载与网络</h4>
            <SettingItems
              mod="Common"
              :items="COMMON_SCHEMA"
            />
          </div>
        </div>
      </NTabPane>

      <NTabPane
        name="modules"
        tab="内容默认设置"
      >
        <div class="st-card">
          <NAlert
            type="info"
            :show-icon="true"
            class="st-note"
          >
            各类内容的默认备份方式与采集细节；在「新建任务」里勾选要备份的内容即可套用。
          </NAlert>
          <NAlert
            type="warning"
            :show-icon="true"
            class="st-note"
          >
            点赞 / 评论属于逐条请求：内容多、点赞人数多时会明显变慢，并可能触发 QQ 空间限流。
            数据量大时建议关闭「获取赞列表」「获取全部评论」「相册评论」「图片评论」；
            如果任务经常停在「获取赞列表 / 获取评论」阶段，请先关闭对应开关再重试。
          </NAlert>
          <NCollapse :default-expanded-names="['Messages']">
            <NCollapseItem
              v-for="m in MODULE_KEYS"
              :key="m"
              :title="MODULE_META[m]?.label || m"
              :name="m"
            >
              <SettingItems
                :mod="m"
                :items="MODULE_SCHEMA[m] || []"
              />
            </NCollapseItem>
          </NCollapse>
        </div>
      </NTabPane>

      <NTabPane
        name="albums"
        tab="相册选择"
      >
        <div class="st-card">
          <div class="st-block">
            <div class="st-row">
              <h4>备份哪些相册？</h4>
              <div class="st-actions">
                <NButton
                  size="tiny"
                  quaternary
                  :loading="albumSelectLoading"
                  @click="loadAlbumsForSelect()"
                >
                  刷新列表
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  @click="cfg.albumSelAll()"
                >
                  全选
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  @click="cfg.albumSelNone()"
                >
                  清空
                </NButton>
              </div>
            </div>
            <NAlert
              v-if="cfg.albumError"
              type="error"
              :show-icon="true"
              class="st-note"
            >
              {{ cfg.albumError }}（需要登录且勾选过「相册」模块）
            </NAlert>
            <p
              v-else
              class="st-tip"
            >
              {{ albumHint }}
            </p>
            <NSelect
              v-model:value="cfg.albumSel"
              multiple
              filterable
              clearable
              :options="albumOptions"
              :loading="albumSelectLoading"
              placeholder="选择要备份的相册（可按名称搜索）"
              size="small"
              :max-tag-count="6"
            />
          </div>
        </div>
      </NTabPane>

      <NTabPane
        name="advanced"
        tab="高级"
      >
        <div class="st-card">
          <div class="st-block">
            <h4>开发者</h4>
            <SettingItems
              mod="Dev"
              :items="DEV_SCHEMA"
            />
          </div>
          <div class="st-block">
            <h4>配置管理</h4>
            <div class="st-actions">
              <NButton
                size="small"
                @click="exportConfig"
              >
                导出配置
              </NButton>
              <NButton
                size="small"
                @click="importConfig"
              >
                导入配置
              </NButton>
              <NButton
                size="small"
                type="warning"
                secondary
                @click="confirmReset"
              >
                恢复默认
              </NButton>
            </div>
          </div>
          <div class="st-block">
            <h4>引擎连接</h4>
            <p class="st-tip">
              备份页面加载失败时，可尝试重新注入引擎脚本。
            </p>
            <div class="st-actions">
              <NInput
                :value="bk.engineReady ? '引擎已就绪' : '引擎未就绪'"
                readonly
                size="small"
                class="ctl"
              />
              <NButton
                size="small"
                @click="bk.retryEngine()"
              >
                重新连接
              </NButton>
            </div>
          </div>
          <div class="st-block">
            <h4>日志</h4>
            <p class="st-tip">
              应用日志按天存为 main-日期.log（保留 14 天）；每次备份另有独立任务日志 backup-*.log（保留最近 20 次）。反馈备份问题时可直接提供对应任务的那个文件。
            </p>
            <div class="st-actions">
              <NButton
                size="small"
                @click="openLogsDir"
              >
                打开日志目录
              </NButton>
            </div>
          </div>
        </div>
      </NTabPane>

      <NTabPane
        name="privacy"
        tab="隐私政策"
      >
        <div class="st-card">
          <div class="st-block">
            <h4>本地优先</h4>
            <p class="st-tip">
              本应用不接入任何自建服务器。采集通过本机登录的 QQ 空间会话完成，备份数据只写入你在新建任务时选择的目录。
            </p>
          </div>
          <div class="st-block">
            <h4>登录凭证</h4>
            <p class="st-tip">
              QQ 登录 Cookie 保存在 Electron 的本地会话分区（persist:qzone），仅用于访问 QQ 空间；应用不会上传 Cookie，也不会在日志中记录完整凭证。
            </p>
          </div>
          <div class="st-block">
            <h4>备份数据</h4>
            <p class="st-tip">
              说说、相册、日志等档案保存在你选择的本地目录，卸载应用不会主动删除这些档案。应用配置、任务记录与日志位于
              <code>%APPDATA%\qzone-archiver-desktop</code>。
            </p>
          </div>
          <div class="st-block">
            <h4>他人空间</h4>
            <p class="st-tip">
              备份他人空间仅采集对方公开内容；访客、日记、好友、收藏等仅本人可见的内容会自动跳过。访问会像普通浏览一样留下访客记录，请尊重他人隐私并遵守平台规则。
            </p>
          </div>
          <div class="st-block">
            <h4>检查更新</h4>
            <p class="st-tip">
              手动检查更新只读取 GitHub Releases 的公开版本信息与安装包列表，不自动下载、不静默安装，也不会上传任何用户数据。
            </p>
          </div>
          <div class="st-block">
            <h4>免责声明</h4>
            <p class="st-tip">
              本项目依赖 QQ 空间内部 Web 接口，仅用于备份自己的数据，使用风险由使用者自行承担；本项目与腾讯 / QQ 空间无隶属关系。
            </p>
          </div>
        </div>
      </NTabPane>

      <NTabPane
        name="about"
        tab="关于与更新"
      >
        <div class="st-card">
          <div class="st-block about-head">
            <div>
              <h4>空间档案备份</h4>
              <p class="st-tip">
                v{{ update.currentVersion || '—' }} · {{ update.platform || 'win32' }} {{ update.arch || 'x64' }}
              </p>
            </div>
            <div class="st-actions">
              <NButton
                size="small"
                @click="openLink(REPO_URL)"
              >
                GitHub 仓库
              </NButton>
              <NButton
                size="small"
                @click="openLink(RELEASES_URL)"
              >
                发布页面
              </NButton>
              <NButton
                size="small"
                @click="openLink(LICENSE_URL)"
              >
                开源许可
              </NButton>
            </div>
          </div>
          <div class="st-block">
            <h4>检查更新</h4>
            <UpdatePanel />
          </div>
          <div class="st-block">
            <h4>致谢</h4>
            <p class="st-tip">
              基于 ShunCai/QZoneExport 二次开发，遵循 Apache-2.0；感谢所有提交反馈、提供日志与帮助测试的用户。
            </p>
          </div>
        </div>
      </NTabPane>
    </NTabs>
  </section>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.st-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.st-head p {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}
.st-tabs {
  flex: 1;
}
.st-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 24px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}
.st-block h4 {
  margin: 0 0 10px;
  font-size: 14px;
}
.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.st-row h4 {
  margin: 0;
}
.st-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.st-note {
  margin-bottom: 4px;
}
.st-tip {
  margin: 0 0 10px;
  font-size: 12.5px;
  opacity: 0.55;
}
.about-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.about-head .st-actions {
  margin-bottom: 0;
}
.st-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-soft);
  font-family: var(--mono-font);
  font-size: 11.5px;
}
.ctl {
  width: 200px;
}
.st-block :deep(.st-actions) {
  margin-bottom: 0;
}
</style>
