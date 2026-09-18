<script setup lang="ts">
/**
 * 设置（v4.6 精简重写）：通用 / 内容默认设置 / 相册选择 / 高级
 * 全部数据源为 config store（settings + albums），自动保存；schema 由 config-spec.json 生成
 */
import { ref, onMounted } from 'vue';
import {
  NTabs, NTabPane, NCollapse, NCollapseItem, NButton, NSelect, NAlert, NInput,
  useDialog, useMessage,
} from 'naive-ui';
import { useConfigStore, MODULE_META, MODULE_KEYS } from '../stores/config';
import { COMMON_SCHEMA, MODULE_SCHEMA, DEV_SCHEMA } from '../stores/schema';
import { useAppearanceStore } from '../stores/appearance';
import { useBackupStore } from '../stores/backup';
import SettingItems from '../components/settings/SettingItems.vue';

const cfg = useConfigStore();
const appearance = useAppearanceStore();
const bk = useBackupStore();
const dialog = useDialog();
const message = useMessage();

const themeOptions = [
  { label: '跟随系统（自动切换深浅色）', value: 'auto' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];

/* -------- 检查更新（GitHub Releases） -------- */
type UpdateInfo = {
  ok: boolean;
  current?: string;
  latest?: string;
  hasUpdate?: boolean;
  url?: string;
  notes?: string;
  error?: string;
};
const checkingUpdate = ref(false);
const updateInfo = ref<UpdateInfo | null>(null);
const appVersion = ref('');

async function checkUpdate() {
  if (checkingUpdate.value) return;
  checkingUpdate.value = true;
  updateInfo.value = null;
  try {
    const r = await window.api.app.checkUpdate();
    updateInfo.value = r;
  } catch (e: any) {
    updateInfo.value = { ok: false, error: e?.message || String(e) };
  } finally {
    checkingUpdate.value = false;
  }
}

function openUpdatePage() {
  if (updateInfo.value?.url) window.api.app.openExternal(updateInfo.value.url);
}

/* -------- 日志（v4.9 §K） -------- */
function openLogsDir() {
  window.api.app.openLogs();
}

/* -------- 相册选择 -------- */
const albumOptions = ref<{ type: string; label: string; children?: { label: string; value: string }[] }[]>([]);
const albumSelectLoading = ref(false);

async function loadAlbumsForSelect() {
  if (albumSelectLoading.value) return;
  albumSelectLoading.value = true;
  cfg.albumError = '';
  await cfg.loadAlbums();
  albumOptions.value = cfg.albumClassNames.map((g) => ({
    type: 'group',
    label: g.cls,
    key: g.cls,
    children: g.items.map((a) => ({ label: `${a.name}${a.total != null ? `（${a.total}）` : ''}`, value: String(a.id) })),
  })) as any;
  albumSelectLoading.value = false;
}

onMounted(() => {
  // 相册列表按需加载（进入该页时预取，登录后有效）
  if (!cfg.albums.length) loadAlbumsForSelect();
  window.api.app.getInfo().then((i) => (appVersion.value = i.version));
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
      animated
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
              已选 {{ cfg.albumSel.length }} / {{ cfg.albums.length }} 个相册；不选择任何相册时备份全部。
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
              应用日志 main.log 与每次备份的任务日志 backup-*.log 都在这里；反馈备份问题时可直接提供对应任务的那个文件。
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
          <div class="st-block">
            <h4>关于与更新</h4>
            <p class="st-tip">当前版本 v{{ updateInfo?.current || appVersion || '—' }}；更新源为 GitHub Releases，仅提醒、不自动下载。</p>
            <div class="st-actions">
              <NButton size="small" type="primary" secondary round :loading="checkingUpdate" @click="checkUpdate">
                检查更新
              </NButton>
              <NButton v-if="updateInfo?.hasUpdate" size="small" type="primary" round @click="openUpdatePage">
                前往下载 v{{ updateInfo?.latest }}
              </NButton>
              <NButton
                v-else-if="updateInfo?.ok"
                size="small"
                quaternary
                round
                @click="openUpdatePage"
              >
                查看发布页
              </NButton>
            </div>
            <NAlert
              v-if="updateInfo?.ok && !updateInfo.hasUpdate"
              type="success"
              :show-icon="true"
              class="st-note"
            >
              已是最新版本（v{{ updateInfo.latest }}）
            </NAlert>
            <NAlert
              v-else-if="updateInfo?.ok && updateInfo.hasUpdate"
              type="info"
              :show-icon="true"
              class="st-note"
            >
              发现新版本 v{{ updateInfo.latest }}（当前 v{{ updateInfo.current }}），点击「前往下载」获取安装包。
            </NAlert>
            <NAlert
              v-else-if="updateInfo && !updateInfo.ok"
              type="warning"
              :show-icon="true"
              class="st-note"
            >
              {{ updateInfo.error }}
            </NAlert>
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
.ctl {
  width: 200px;
}
.st-block :deep(.st-actions) {
  margin-bottom: 0;
}
</style>
