<script setup lang="ts">
/** 设置视图（S5）：公共 / 模块 / 开发者 分组设置
 *  层级：页头 → 分区 tab → 表单组 → 底部操作（保存 + 危险区恢复默认）
 *  交互：未保存修改提示、恢复默认确认、离开未保存确认
 */
import { ref, watch, onMounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  useConfigStore, COMMON_SCHEMA, MODULE_SCHEMA, DEV_SCHEMA,
  MODULES, MODULE_META, defaultSettings,
} from '../stores/config';
import { useAuth } from '../stores/auth';
import { useBackupStore } from '../stores/backup';
import { CSelect } from '../components/ui/CSelect';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';

const cfg = useConfigStore();
const {
  settings, getPath, setPath, toPlain, toLocalTime, toDbTime,
  albums, albumsLoading, albumError, albumSel, albumClassNames,
  loadAlbums, albumSelAll, albumSelNone,
} = cfg;
const { auth } = useAuth();
const { pushLog } = useBackupStore();

const TABS = [
  { key: 'Common', label: '公共' },
  ...MODULES.filter((m) => m !== 'Statistics').map((m) => ({ key: m, label: MODULE_META[m].label })),
  { key: 'Dev', label: '开发者' },
];

const tab = ref('Common');

/* ============ 未保存检测 ============ */
const saved = ref(true);
const savedSnapshot = ref('');
watch(
  () => JSON.stringify(toPlain(settings.value)),
  () => {
    if (savedSnapshot.value && savedSnapshot.value !== JSON.stringify(toPlain(settings.value))) {
      saved.value = false;
    }
  }
);
onMounted(() => {
  savedSnapshot.value = JSON.stringify(toPlain(settings.value));
});

function save() {
  window.api.config
    .set({ engineSettings: toPlain(settings.value) })
    .then(() => {
      pushLog('info', '设置已保存');
      saved.value = true;
      savedSnapshot.value = JSON.stringify(toPlain(settings.value));
    })
    .catch((e: any) => pushLog('error', `设置保存失败：${e?.message || e}`));
}

/* ============ 恢复默认（带确认） ============ */
const showResetConfirm = ref(false);
function doReset() {
  settings.value = defaultSettings();
  showResetConfirm.value = false;
  saved.value = false;
}

/* ============ 离开未保存确认 ============ */
const showLeaveConfirm = ref(false);
let pendingLeave: (() => void) | null = null;
onBeforeRouteLeave((to, from, next) => {
  if (!saved.value) {
    showLeaveConfirm.value = true;
    pendingLeave = next;
    return;
  }
  next();
});
function leaveProceed() {
  const fn = pendingLeave;
  pendingLeave = null;
  showLeaveConfirm.value = false;
  fn?.();
}
function leaveCancel() {
  pendingLeave = null;
  showLeaveConfirm.value = false;
}

/* ============ 相册选择（Photos tab 时加载） ============ */
watch(
  () => tab.value,
  (t) => {
    if (t === 'Photos' && auth.loggedIn && !albums.value.length && !albumsLoading.value) {
      loadAlbums();
    }
  }
);
</script>

<template>
  <section class="settings-view">
    <div class="sv-head">
      <h2 class="view-title">
        设置
      </h2>
      <p class="view-desc">
        调整备份类型与采集选项，修改后点击「保存」生效。
      </p>
    </div>

    <nav
      class="sv-tabs"
      role="tablist"
    >
      <button
        v-for="t in TABS"
        :key="t.key"
        class="sv-tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="sv-content">
      <!-- 公共 -->
      <template v-if="tab === 'Common'">
        <div class="sv-group">
          <h4 class="sv-group-title">
            通用
          </h4>
          <div
            v-for="item in COMMON_SCHEMA"
            :key="item.key"
            class="setrow"
          >
            <label class="set-label">{{ item.label }}</label>
            <CSelect
              v-if="item.type === 'select'"
              :model-value="getPath(settings.Common, item.key)"
              :options="item.options"
              :label-map="item.labelMap"
              @update:model-value="setPath(settings.Common, item.key, $event)"
            />
            <input
              v-else-if="item.type === 'checkbox'"
              type="checkbox"
              :checked="getPath(settings.Common, item.key)"
              @change="setPath(settings.Common, item.key, ($event.target as HTMLInputElement).checked)"
            >
            <input
              v-else-if="item.type === 'number'"
              type="number"
              :value="getPath(settings.Common, item.key)"
              :min="item.min"
              :max="item.max"
              :step="item.step ?? 1"
              @input="setPath(settings.Common, item.key, Number(($event.target as HTMLInputElement).value))"
            >
            <textarea
              v-else-if="item.type === 'textarea'"
              :value="(getPath(settings.Common, item.key) || []).join('\n')"
              @input="setPath(settings.Common, item.key, ($event.target as HTMLTextAreaElement).value.split('\n').map((s) => s.trim()).filter(Boolean))"
            />
            <input
              v-else
              type="text"
              :value="getPath(settings.Common, item.key)"
              @input="setPath(settings.Common, item.key, ($event.target as HTMLInputElement).value)"
            >
            <span
              v-if="item.help"
              class="set-help"
            >{{ item.help }}</span>
          </div>
        </div>
      </template>

      <!-- 模块 -->
      <template v-else-if="tab !== 'Dev' && MODULE_SCHEMA[tab]">
        <!-- 相册选择（仅相册模块） -->
        <div
          v-if="tab === 'Photos'"
          class="sv-group"
        >
          <h4 class="sv-group-title">
            相册选择
          </h4>
          <p class="sv-group-desc">
            默认全选；取消勾选则不备份该相册。
          </p>
          <div class="album-sel">
            <div class="album-sel-actions">
              <button
                class="btn sm"
                :disabled="albumsLoading || !auth.loggedIn"
                @click="loadAlbums"
              >
                {{ albumsLoading ? '加载中…' : albums.length ? '重新加载' : '加载相册列表' }}
              </button>
              <template v-if="albums.length">
                <button
                  class="btn sm"
                  @click="albumSelAll"
                >
                  全选
                </button>
                <button
                  class="btn sm"
                  @click="albumSelNone"
                >
                  清空
                </button>
              </template>
            </div>
            <div
              v-if="albumError"
              class="album-error"
            >
              {{ albumError }}
            </div>
            <div
              v-else-if="!albums.length && !albumsLoading"
              class="album-empty"
            >
              {{ auth.loggedIn ? '点击「加载相册列表」获取你的相册' : '请先登录 QQ 空间再加载相册列表' }}
            </div>
            <div
              v-else-if="albums.length"
              class="album-list"
            >
              <div
                v-for="g in albumClassNames"
                :key="g.cls"
                class="album-group"
              >
                <div class="album-group-name">
                  {{ g.cls }}
                </div>
                <label
                  v-for="a in g.items"
                  :key="a.id"
                  class="album-item"
                >
                  <input
                    v-model="albumSel"
                    type="checkbox"
                    :value="String(a.id)"
                    class="album-check"
                  >
                  <span
                    class="album-name"
                    :title="a.desc || a.name"
                  >{{ a.name }}</span>
                  <span class="album-cnt">{{ a.total ?? 0 }} 张</span>
                </label>
              </div>
            </div>
            <div
              v-if="albums.length"
              class="album-foot"
            >
              已选 <b>{{ albumSel.length }}</b> 个相册{{ albumSel.length ? '' : '（将不备份相册）' }}
            </div>
          </div>
        </div>

        <div class="sv-group">
          <h4 class="sv-group-title">
            {{ MODULE_META[tab].label }}设置
          </h4>
          <div
            v-for="item in MODULE_SCHEMA[tab]"
            v-show="item.key !== 'IncrementTime' || getPath(settings[tab], 'IncrementType') === 'Custom'"
            :key="item.key"
            class="setrow"
          >
            <label class="set-label">{{ item.label }}</label>
            <CSelect
              v-if="item.type === 'select'"
              :model-value="getPath(settings[tab], item.key)"
              :options="item.options"
              :label-map="item.labelMap"
              @update:model-value="setPath(settings[tab], item.key, $event)"
            />
            <input
              v-else-if="item.type === 'checkbox'"
              type="checkbox"
              :checked="getPath(settings[tab], item.key)"
              @change="setPath(settings[tab], item.key, ($event.target as HTMLInputElement).checked)"
            >
            <template v-else-if="item.type === 'range'">
              <div class="range-row">
                <input
                  type="number"
                  :value="getPath(settings[tab], item.key)?.min"
                  :min="item.min ?? 1"
                  title="最小间隔（秒）"
                  @input="setPath(settings[tab], `${item.key}.min`, Number(($event.target as HTMLInputElement).value))"
                >
                <span class="range-sep">~</span>
                <input
                  type="number"
                  :value="getPath(settings[tab], item.key)?.max"
                  :min="item.min ?? 1"
                  title="最大间隔（秒）"
                  @input="setPath(settings[tab], `${item.key}.max`, Number(($event.target as HTMLInputElement).value))"
                >
              </div>
            </template>
            <input
              v-else-if="item.type === 'datetime'"
              type="datetime-local"
              class="set-datetime"
              :value="toLocalTime(getPath(settings[tab], item.key))"
              @input="setPath(settings[tab], item.key, toDbTime(($event.target as HTMLInputElement).value))"
            >
            <input
              v-else
              type="number"
              :value="getPath(settings[tab], item.key)"
              :min="item.min"
              :max="item.max"
              @input="setPath(settings[tab], item.key, Number(($event.target as HTMLInputElement).value))"
            >
            <span
              v-if="item.help"
              class="set-help"
            >{{ item.help }}</span>
          </div>
        </div>
      </template>

      <!-- 开发者 -->
      <template v-else-if="tab === 'Dev'">
        <div class="sv-group">
          <h4 class="sv-group-title">
            开发者
          </h4>
          <p class="sv-group-desc">
            高级配置，一般用户无需修改。
          </p>
          <div
            v-for="item in DEV_SCHEMA"
            :key="item.key"
            class="setrow"
          >
            <label class="set-label">{{ item.label }}</label>
            <input
              type="text"
              :value="getPath(settings.Dev, item.key)"
              @input="setPath(settings.Dev, item.key, ($event.target as HTMLInputElement).value)"
            >
            <span
              v-if="item.help"
              class="set-help"
            >{{ item.help }}</span>
          </div>
        </div>
      </template>
    </div>

    <div class="sv-actions">
      <div class="sv-actions-left">
        <button
          class="btn primary"
          @click="save"
        >
          保存设置
        </button>
        <span
          v-if="!saved"
          class="sv-unsaved"
        >有未保存的修改</span>
      </div>
      <div class="sv-actions-right">
        <button
          class="btn danger ghost-sm"
          @click="showResetConfirm = true"
        >
          恢复默认
        </button>
      </div>
    </div>

    <ConfirmDialog
      :show="showResetConfirm"
      title="恢复默认设置？"
      message="所有模块的设置将恢复为默认值。当前尚未保存的修改也会被覆盖。"
      confirm-text="恢复默认"
      danger
      @confirm="doReset"
      @cancel="showResetConfirm = false"
    />
    <ConfirmDialog
      :show="showLeaveConfirm"
      title="有未保存的修改"
      message="离开设置页将丢失未保存的修改，确定要离开吗？"
      confirm-text="放弃修改"
      @confirm="leaveProceed"
      @cancel="leaveCancel"
    />
  </section>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
}
.sv-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.view-title {
  margin: 0;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 20px;
  color: var(--accent-deep);
  letter-spacing: 1px;
}
.view-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-soft);
}

/* 分区 tab（一级层级） */
.sv-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
}
.sv-tab {
  padding: 5px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  font-size: 12.5px;
  color: var(--ink-soft);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease;
}
.sv-tab:hover {
  background: var(--line-soft);
  color: var(--ink);
}
.sv-tab.active {
  background: var(--accent);
  color: #fbe9d8;
  font-weight: 600;
}

/* 表单组（二级层级） */
.sv-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sv-group {
  background: var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sv-group-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--accent-deep);
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--line-soft);
}
.sv-group-desc {
  margin: -4px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.setrow {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}
.set-label {
  flex-shrink: 0;
  width: 140px;
  color: var(--ink);
}
.setrow input[type='text'],
.setrow input[type='number'],
.setrow textarea,
.set-datetime {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #fffdf7;
  padding: 5px 9px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--ink);
  min-width: 120px;
}
.setrow textarea {
  flex: 1;
  min-height: 56px;
  resize: vertical;
}
.set-help {
  font-size: 11.5px;
  color: var(--ink-soft);
}
.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.range-sep {
  color: var(--ink-soft);
  font-size: 12px;
}

/* 相册选择 */
.album-sel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.album-sel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.album-error {
  color: var(--err);
  font-size: 12.5px;
}
.album-empty {
  color: var(--ink-soft);
  font-size: 12.5px;
}
.album-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}
.album-group-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-deep);
  margin: 4px 0 2px;
}
.album-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  cursor: pointer;
}
.album-check {
  accent-color: var(--accent);
  margin: 0;
}
.album-name {
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.album-cnt {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.album-foot {
  font-size: 12px;
  color: var(--ink-soft);
}

/* 底部操作（保存 + 危险区） */
.sv-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 4px 0;
  border-top: 1px dashed var(--line-soft);
}
.sv-actions-left,
.sv-actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sv-unsaved {
  font-size: 12px;
  color: var(--accent);
}
.btn.danger.ghost-sm {
  background: transparent;
  border-color: #d8a08a;
  color: var(--err);
}
.btn.danger.ghost-sm:hover {
  background: #fbeee7;
}
</style>
