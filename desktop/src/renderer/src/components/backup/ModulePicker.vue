<script setup lang="ts">
/** 备份内容选择（S3 步骤①）
 *  11 模块卡片默认全选 + 数据量估算；
 *  下方「备份设置」为简洁面板：备份格式 / 只备份新增内容，应用到全部已选模块，
 *  直接读写 stores/config.ts 的 settings（与设置模态实时联动）
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../../stores/auth';
import {
  useConfigStore, MODULE_KEYS, EXPORT_OPTS,
  MODULES, MODULE_ICONS, MODULE_META, getPath, setPath,
} from '../../stores/config';
import { CSelect } from '../ui/CSelect';

const { auth } = useAuthStore();
const cfg = useConfigStore();
const {
  selected, selectedCount, selectedModules, settings,
  albums, albumsLoading, albumError, albumSel, albumClassNames,
} = storeToRefs(cfg);
const { loadAlbums, albumSelAll, albumSelNone } = cfg;

defineProps<{ estimates: Record<string, number> }>();

function selectAll() {
  for (const m of MODULES) selected.value[m] = true;
}
function selectNone() {
  for (const m of MODULES) selected.value[m] = false;
}
function estText(estimates: Record<string, number>, m: string) {
  const n = estimates[m];
  return n ? `${n.toLocaleString()} 条` : '—';
}

/** 已选且有导出类型的模块（Statistics 除外） */
function contentModules() {
  return selectedModules.value.filter((m) => MODULE_KEYS.includes(m));
}

/* ============ 简洁备份设置（应用到全部已选模块，联动设置模态） ============ */

const EXPORT_MAP: Record<string, string> = {
  SPA: '网页版', HTML: '单文件网页', MarkDown: '文本', JSON: '原始数据',
};

/** 备份格式：已选模块 exportType 唯一则显示该值，否则显示首个已选模块的值；修改时应用到全部已选模块 */
const exportType = computed<string>({
  get() {
    const mods = contentModules();
    if (!mods.length) return 'SPA';
    const types = [...new Set(mods.map((m) => settings.value[m]?.exportType).filter(Boolean))];
    return types[0] || 'SPA';
  },
  set(v: string) {
    for (const m of contentModules()) setPath(settings.value[m], 'exportType', v);
  },
});

/** 只备份新增内容：IncrementType = Last/Full，应用到全部已选模块 */
const incremental = computed<boolean>({
  get() {
    const first = contentModules()[0];
    return first ? getPath(settings.value[first], 'IncrementType') === 'Last' : false;
  },
  set(on: boolean) {
    for (const m of contentModules()) setPath(settings.value[m], 'IncrementType', on ? 'Last' : 'Full');
  },
});
</script>

<template>
  <div class="module-picker">
    <div class="mp-head">
      <span class="mp-title">备份哪些内容？</span>
      <div class="mp-actions">
        <span class="mp-count">已选 {{ selectedCount }} 项</span>
        <button
          class="btn sm"
          @click="selectAll"
        >
          全选
        </button>
        <button
          class="btn sm"
          @click="selectNone"
        >
          全不选
        </button>
      </div>
    </div>

    <div class="mod-grid">
      <label
        v-for="m in MODULES"
        :key="m"
        class="mod"
        :class="{ picked: selected[m] }"
      >
        <input
          v-model="selected[m]"
          type="checkbox"
          class="mod-check"
        >
        <svg
          class="mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="MODULE_ICONS[m]" />
        </svg>
        <span class="mod-name">{{ MODULE_META[m].label }}</span>
        <span class="mod-est">{{ estText(estimates, m) }}</span>
      </label>
    </div>

    <div class="mp-settings">
      <div class="mp-settings-title">
        备份设置
        <span class="ms-sub">（应用到全部已选模块，与「设置」实时联动）</span>
      </div>
      <div class="ms-row">
        <span class="ms-label">备份格式</span>
        <CSelect
          v-model="exportType"
          :options="EXPORT_OPTS"
          :label-map="EXPORT_MAP"
          class="ms-control"
        />
        <span class="ms-help">备份产物的呈现方式；「网页版」便于浏览</span>
      </div>
      <label class="ms-check">
        <input
          v-model="incremental"
          type="checkbox"
        >
        <span>只备份新增内容（上次备份后新增的数据，速度更快）</span>
      </label>
    </div>

    <!-- 相册选择（勾选「相册」模块时显示；状态与设置模态共享） -->
    <div
      v-if="selected.Photos"
      class="mp-albums"
    >
      <div class="mp-albums-head">
        <span class="mp-albums-title">相册选择</span>
        <span class="ms-sub">默认全选；取消勾选则不备份</span>
      </div>
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

    <p class="mp-hint">
      数字为上次备份的数据量估算；未备份过则显示 —。模块的更多细项（评论/赞/访客等）可在「设置」中调整。
    </p>
  </div>
</template>

<style scoped>
.mp-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.mp-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.mp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mp-count {
  font-size: 12px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.mp-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}

/* 模块卡片 */
.mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.mod {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  background: var(--card-2);
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}
.mod:hover {
  border-color: #c8b28a;
  background: #f3ebd8;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(80, 60, 30, 0.08);
}
.mod.picked {
  border-color: var(--accent);
  background: #f6ead8;
}
.mod-check {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 1px solid #c3ad8a;
  border-radius: 4px;
  background: #fff;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}
.mod-check:checked {
  background: var(--accent);
  border-color: var(--accent);
}
.mod-check:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.mod-check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.mod-icon {
  width: 15px;
  height: 15px;
  color: var(--accent);
  flex-shrink: 0;
}
.mod-name {
  font-weight: 600;
}
.mod-est {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 简洁备份设置 */
.mp-settings {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  background: rgba(196, 176, 138, 0.06);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

/* 相册选择（勾选「相册」模块时显示；列表样式复用全局 .album-*） */
.mp-albums {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  background: rgba(196, 176, 138, 0.06);
}
.mp-albums-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}
.mp-albums-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent-deep);
}
.mp-settings-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent-deep);
}
.ms-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--ink-soft);
}
.ms-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
}
.ms-label {
  flex-shrink: 0;
  width: 64px;
  color: var(--ink);
}
.ms-control {
  flex: none;
  width: 160px;
}
.ms-control .cs-val {
  padding: 4px 9px;
  font-size: 12.5px;
}
.ms-help {
  font-size: 11px;
  color: var(--ink-soft);
}
.ms-check {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--ink);
}
.ms-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
  margin: 0;
}
</style>
