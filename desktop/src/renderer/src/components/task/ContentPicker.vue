<script setup lang="ts">
/**
 * 向导第②步：选择备份内容（模块卡片多选）
 * 他人模式下日记/好友/收藏（仅本人可见）自动禁用并说明
 */
import { computed } from 'vue';
import { NTooltip } from 'naive-ui';
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

/** 他人空间不可见的模块（与引擎侧 PRIVATE_MODULES 对应） */
const PRIVATE = new Set(['Diaries', 'Friends', 'Favorites']);

const ITEMS = computed(() =>
  MODULES.filter((m) => m !== 'Statistics').map((m) => ({
    key: m,
    label: MODULE_META[m]?.label || m,
    icon: MODULE_ICONS[m] || '',
    estimate: props.estimates?.[m],
    disabled: target.isOtherUser && PRIVATE.has(m),
  }))
);

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
        {{ target.isOtherUser ? '好友空间仅可备份公开内容，私密项已自动禁用' : '选择本次要备份的内容类型' }}
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
</style>
