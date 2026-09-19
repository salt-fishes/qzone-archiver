<script setup lang="ts">
/**
 * 向导第②步：选择备份内容（模块卡片多选）
 * 他人模式下日记/好友/收藏（仅本人可见）自动禁用并说明
 */
import { computed, watch } from 'vue';
import { NDatePicker, NTooltip, NSelect, NButton, NAlert } from 'naive-ui';
import { Motion } from 'motion-v';
import { MODULES, MODULE_META, MODULE_ICONS } from '../../stores/config';
import { useConfigStore } from '../../stores/config';
import { useTargetStore } from '../../stores/target';

const props = defineProps<{
  /** 数据量参考（上次备份各模块条目数） */
  estimates?: Record<string, number>;
}>();

const cfg = useConfigStore();
const target = useTargetStore();

/** v4.9.1：向导内相册选择（勾选「相册」时展示；复用 store 的 albumSel → settings.Photos.albumSelect 链路） */
const albumOptions = computed(() =>
  cfg.albumClassNames.map((g) => ({
    type: 'group' as const,
    label: g.cls,
    key: g.cls,
    children: g.items.map((a) => ({
      label: `${a.name}${a.total != null ? `（${a.total}）` : ''}`,
      value: String(a.id),
    })),
  }))
);

/** 他人空间不可见的模块（与引擎侧 PRIVATE_MODULES 对应） */
const PRIVATE = new Set(['Diaries', 'Friends', 'Favorites']);

/**
 * v4.7 反馈 ③：切到好友模式时，把「仅本人可见」的模块**取消勾选**。
 * 此前只是置灰，勾选状态仍保留 —— 用户会以为会备份，实际引擎会跳过。
 * 切回本人时恢复原勾选（记住被自动取消的项，而不是无脑全开）。
 */
let restored: string[] = [];
watch(
  () => target.isOtherUser,
  (isOther) => {
    if (isOther) {
      restored = [...PRIVATE].filter((m) => cfg.selected[m]);
      for (const m of PRIVATE) cfg.selected[m] = false;
    } else if (restored.length) {
      for (const m of restored) cfg.selected[m] = true;
      restored = [];
    }
  },
  { immediate: true }
);

const ITEMS = computed(() =>
  MODULES.filter((m) => m !== 'Statistics').map((m) => ({
    key: m,
    label: MODULE_META[m]?.label || m,
    icon: MODULE_ICONS[m] || '',
    estimate: props.estimates?.[m],
    disabled: target.isOtherUser && PRIVATE.has(m),
  }))
);

/** 本次备份方式选项（仅本次生效，不写回设置） */
const MODES: { key: 'default' | 'Full' | 'Last' | 'Custom'; label: string }[] = [
  { key: 'default', label: '按设置' },
  { key: 'Full', label: '全量' },
  { key: 'Last', label: '上次之后' },
  { key: 'Custom', label: '自定义时间' },
];
const MODE_HINTS: Record<string, string> = {
  default: '使用「设置」里每个模块各自的增量配置',
  Full: '本次从头完整备份，耗时最长、最完整',
  Last: '本次只采集上次备份之后的新内容，速度快',
  Custom: '本次从下面指定的时间点开始',
};

/** 本次自定义时间（毫秒）与写回（引擎格式 yyyy-MM-dd HH:mm:ss） */
const customTimeMs = computed(() => {
  const t = new Date(String(cfg.backupCustomTime || '').replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : Date.now();
});
function onCustomTimeChange(v: number | null) {
  if (v == null) return;
  const d = new Date(v);
  const p2 = (n: number) => String(n).padStart(2, '0');
  cfg.backupCustomTime =
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ` +
    `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

function toggle(key: string) {
  if (target.isOtherUser && PRIVATE.has(key)) return;
  cfg.selected[key] = !cfg.selected[key];
}

function selectAll() {
  for (const it of ITEMS.value) {
    if (!it.disabled) cfg.selected[it.key] = true;
  }
}

function selectNone() {
  for (const it of ITEMS.value) cfg.selected[it.key] = false;
}
</script>

<template>
  <div class="content-picker">
    <div class="cp-toolbar">
      <span class="cp-hint">
        {{ target.isOtherUser ? '好友空间仅可备份公开内容，私密项已自动取消勾选' : '选择本次要备份的内容类型' }}
      </span>
      <div class="cp-actions">
        <button
          class="txt-btn"
          @click="selectAll"
        >
          全选
        </button>
        <button
          class="txt-btn"
          @click="selectNone"
        >
          清空
        </button>
      </div>
    </div>

    <!-- v4.7 反馈 ④：本次备份方式（仅本次生效；设置里逐模块调过增量时不显示） -->
    <div
      v-if="!cfg.moduleIncrementCustomized"
      class="cp-mode"
    >
      <span class="cpm-label">本次备份方式</span>
      <div class="cpm-opts">
        <button
          v-for="m in MODES"
          :key="m.key"
          class="cpm-btn"
          :class="{ active: cfg.backupMode === m.key }"
          @click="cfg.backupMode = m.key"
        >
          {{ m.label }}
        </button>
      </div>
      <span class="cpm-hint">{{ MODE_HINTS[cfg.backupMode] }}</span>
      <!-- 选了「自定义时间」就地给时间选择器，不必再去设置里翻模块配置 -->
      <NDatePicker
        v-if="cfg.backupMode === 'Custom'"
        :value="customTimeMs"
        type="datetime"
        size="small"
        class="cpm-date"
        :is-date-disabled="(ts: number) => ts > Date.now()"
        @update:value="onCustomTimeChange"
      />
    </div>

    <div class="cp-grid">
      <Motion
        v-for="(it, i) in ITEMS"
        :key="it.key"
        tag="div"
        :initial="{ opacity: 0, y: 10 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.25, delay: i * 0.03 }"
      >
        <NTooltip
          :disabled="!it.disabled"
          placement="top"
        >
          <template #trigger>
            <button
              class="mod-card"
              :class="{ checked: cfg.selected[it.key], disabled: it.disabled }"
              :disabled="it.disabled"
              @click="toggle(it.key)"
            >
              <div class="mc-top">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path :d="it.icon" />
                </svg>
                <span
                  v-if="cfg.selected[it.key]"
                  class="mc-check"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 12.5l4.2 4.2L19 7" />
                  </svg>
                </span>
              </div>
              <div class="mc-label">
                {{ it.label }}
              </div>
              <div class="mc-meta">
                <span v-if="it.disabled">仅本人可见</span>
                <span v-else-if="it.estimate != null">上次 {{ it.estimate.toLocaleString() }} 条</span>
                <span v-else>&nbsp;</span>
              </div>
            </button>
          </template>
          {{ it.label }}仅对自己可见，备份好友空间时无法采集
        </NTooltip>
      </Motion>
    </div>

    <!-- v4.9.1：勾选「相册」时可在向导内直接选择要备份哪些相册。
         仅本人模式：他人模式的相册 ID 与登录者不一致，向导期 Target 又未就位，不做选择（备份全部）。 -->
    <div
      v-if="cfg.selected.Photos && !target.isOtherUser"
      class="cp-albums"
    >
      <div class="ca-head">
        <span class="ca-title">要备份哪些相册？</span>
        <span class="ca-actions">
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
        </span>
      </div>
      <NAlert
        v-if="cfg.albumError"
        type="warning"
        :show-icon="true"
        class="ca-note"
      >
        {{ cfg.albumError }}（需要登录且引擎已就绪；不影响备份，将备份全部相册）
      </NAlert>
      <p
        v-else
        class="ca-tip"
      >
        已选 {{ cfg.albumSel.length }} / {{ cfg.albums.length }} 个相册；不选择任何相册时备份全部。
      </p>
      <NSelect
        v-model:value="cfg.albumSel"
        multiple
        filterable
        clearable
        :options="albumOptions"
        :loading="cfg.albumsLoading"
        placeholder="选择要备份的相册（可按名称搜索）"
        size="small"
        :max-tag-count="6"
      />
    </div>
  </div>
</template>

<style scoped>
.content-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cp-hint {
  font-size: 12.5px;
  opacity: 0.55;
}
.cp-actions {
  display: flex;
  gap: 12px;
}
.cp-mode {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--surface-soft);
  border: 1px solid var(--surface-border);
}
.cpm-label {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.75;
}
.cpm-opts {
  display: flex;
  gap: 6px;
}
.cpm-btn {
  border: 1px solid var(--surface-border);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all var(--dur-fast) ease;
}
.cpm-btn:hover {
  border-color: rgba(180, 95, 61, 0.5);
}
.cpm-btn.active {
  border-color: #b45f3d;
  background: rgba(180, 95, 61, 0.13);
  color: #b45f3d;
  font-weight: 600;
}
.cpm-hint {
  font-size: 11.5px;
  opacity: 0.55;
}
.cpm-date {
  width: 190px;
}
.txt-btn {
  border: none;
  background: none;
  font-size: 12.5px;
  color: #b45f3d;
  cursor: pointer;
  padding: 2px 4px;
}
.txt-btn:hover {
  text-decoration: underline;
}
.cp-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
@media (max-width: 860px) {
  .cp-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.mod-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: 1.5px solid var(--surface-border);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur-fast) ease, background var(--dur-fast) ease;
}
.mod-card:hover:not(.disabled) {
  border-color: rgba(180, 95, 61, 0.5);
}
.mod-card.checked {
  border-color: #b45f3d;
  background: rgba(180, 95, 61, 0.1);
}
.mod-card.checked .mc-label {
  color: #b45f3d;
}
.mod-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.mc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.mc-top svg {
  width: 21px;
  height: 21px;
  color: #b45f3d;
}
/* v4.7 修复：.mc-top svg 的 color 优先级高于 .mc-check，会把对勾染成主题色、
   在同样主题色的背景上"消失"。这里显式还原为白色（对勾用 currentColor 描边）。 */
.mc-top .mc-check svg {
  width: 12px;
  height: 12px;
  color: #fff;
}
.mc-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid transparent;
  color: transparent;
  opacity: 0; /* 未勾选：不显示任何指示 */
  transition: all var(--dur-fast) ease;
}
.mod-card.checked .mc-check {
  opacity: 1;
  border-color: #b45f3d;
  background: #b45f3d;
  color: #fff;
}
.mc-check svg {
  width: 12px;
  height: 12px;
}
.mc-label {
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 3px;
}
.mc-meta {
  font-size: 11px;
  opacity: 0.5;
}
.cp-albums {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ca-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ca-title {
  font-size: 13px;
  font-weight: 600;
}
.ca-actions {
  display: flex;
  gap: 4px;
}
.ca-note,
.ca-tip {
  margin: 0;
  font-size: 12px;
  opacity: 0.6;
}
</style>
