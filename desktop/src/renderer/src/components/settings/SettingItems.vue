<script setup lang="ts">
/**
 * schema 驱动设置表单（v4.6 重写：Naive UI 控件）
 * 数据源 stores/schema.ts（config-spec.json 生成），读写 config store 的 settings
 */
import { computed } from 'vue';
import { NSelect, NSwitch, NInputNumber, NInput, NDatePicker, NTooltip } from 'naive-ui';
import { useConfigStore, getPath, setPath, toLocalTime, type SettingItem } from '../../stores/config';

const props = defineProps<{
  /** 设置分组名（settings 的顶层键，如 Common / Messages） */
  mod: string;
  items: SettingItem[];
}>();

const cfg = useConfigStore();

/** labelMap 名称解析（schema 里的 labelMap 值导出为常量映射） */
import { EXPORT_MAP, INCREMENT_MAP, DOWNLOAD_MAP } from '../../stores/schema';
const LABEL_MAPS: Record<string, Record<string, string>> = {
  EXPORT_MAP, INCREMENT_MAP, DOWNLOAD_MAP,
};

/** 字段级显示条件（未命中的默认显示） */
const VISIBLE_WHEN: Record<string, (root: any) => boolean> = {
  IncrementTime: (root) => getPath(root, 'IncrementType') === 'Custom',
  'Aria2.rpc': (root) => root?.downloadType === 'Aria2',
  'Aria2.token': (root) => root?.downloadType === 'Aria2',
  useImageProxyGateway: (root) => root?.downloadType === 'Aria2',
  thunderTaskNum: (root) => String(root?.downloadType || '').startsWith('Thunder'),
  thunderTaskSleep: (root) => String(root?.downloadType || '').startsWith('Thunder'),
};

const visibleItems = computed(() =>
  props.items.filter((it) => {
    const rule = VISIBLE_WHEN[it.key];
    return !rule || rule(cfg.settings[props.mod]);
  })
);

function getVal(key: string) {
  return getPath(cfg.settings[props.mod], key);
}
function setVal(key: string, v: unknown) {
  setPath(cfg.settings[props.mod], key, v);
}

function selectOptions(item: SettingItem) {
  // schema 生成的 labelMap 实际为映射表名称（如 "EXPORT_MAP"），类型声明与生成值不一致，此处按名称解析
  const mapName = item.labelMap as unknown as string;
  const map = mapName && typeof mapName === 'string' ? LABEL_MAPS[mapName] : undefined;
  return (item.options || []).map((o) => ({ label: map?.[o] || o, value: o }));
}

function onDatetimeChange(key: string, v: number | null) {
  if (v == null) return;
  const d = new Date(v);
  const p2 = (x: number) => String(x).padStart(2, '0');
  setVal(
    key,
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
  );
}
</script>

<template>
  <div class="setting-items">
    <div
      v-for="it in visibleItems"
      :key="it.key"
      class="s-item"
    >
      <div class="s-info">
        <div class="s-label">
          {{ it.label }}
          <NTooltip
            v-if="it.help"
            trigger="hover"
            placement="top"
            :style="{ maxWidth: '320px' }"
          >
            <template #trigger>
              <span class="s-help">?</span>
            </template>
            {{ it.help }}
          </NTooltip>
        </div>
      </div>

      <div class="s-control">
        <!-- 开关 -->
        <NSwitch
          v-if="it.type === 'checkbox'"
          :value="!!getVal(it.key)"
          size="small"
          @update:value="(v: boolean) => setVal(it.key, v)"
        />

        <!-- 下拉 -->
        <NSelect
          v-else-if="it.type === 'select'"
          :value="getVal(it.key)"
          :options="selectOptions(it)"
          size="small"
          class="ctl-md"
          @update:value="(v: string) => setVal(it.key, v)"
        />

        <!-- 数字 -->
        <NInputNumber
          v-else-if="it.type === 'number'"
          :value="getVal(it.key)"
          size="small"
          class="ctl-sm"
          :min="it.min"
          :max="it.max"
          :step="it.step"
          @update:value="(v: number | null) => v != null && setVal(it.key, v)"
        />

        <!-- 文本 -->
        <NInput
          v-else-if="it.type === 'text'"
          :value="String(getVal(it.key) ?? '')"
          size="small"
          class="ctl-md"
          @update:value="(v: string) => setVal(it.key, v)"
        />

        <!-- 多行文本 -->
        <NInput
          v-else-if="it.type === 'textarea'"
          :value="Array.isArray(getVal(it.key)) ? (getVal(it.key) as string[]).join('\n') : String(getVal(it.key) ?? '')"
          type="textarea"
          :rows="2"
          size="small"
          class="ctl-md"
          placeholder="一行一个域名"
          @update:value="(v: string) => setVal(it.key, v.split('\n').map((s) => s.trim()).filter(Boolean))"
        />

        <!-- 时间 -->
        <NDatePicker
          v-else-if="it.type === 'datetime'"
          :value="new Date(toLocalTime(String(getVal(it.key) || ''))).getTime() || null"
          type="datetime"
          size="small"
          class="ctl-md"
          :is-date-disabled="(ts: number) => ts > Date.now()"
          @update:value="(v: number | null) => onDatetimeChange(it.key, v)"
        />

        <!-- 区间（min/max 两值） -->
        <div
          v-else-if="it.type === 'range'"
          class="range-ctl"
        >
          <NInputNumber
            :value="getPath(getVal(it.key) || {}, 'min')"
            size="small"
            class="ctl-xs"
            :min="it.min"
            @update:value="(v: number | null) => setVal(it.key, { ...(getVal(it.key) || {}), min: v ?? undefined })"
          />
          <span class="range-sep">~</span>
          <NInputNumber
            :value="getPath(getVal(it.key) || {}, 'max')"
            size="small"
            class="ctl-xs"
            :min="it.min"
            @update:value="(v: number | null) => setVal(it.key, { ...(getVal(it.key) || {}), max: v ?? undefined })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setting-items {
  display: flex;
  flex-direction: column;
}
.s-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--surface-border);
}
.s-item:last-child {
  border-bottom: none;
}
.s-info {
  min-width: 0;
}
.s-label {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.s-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  font-size: 10px;
  opacity: 0.55;
  cursor: help;
}
.s-control {
  flex-shrink: 0;
}
.ctl-sm {
  width: 120px;
}
.ctl-xs {
  width: 88px;
}
.ctl-md {
  width: 230px;
}
.range-ctl {
  display: flex;
  align-items: center;
  gap: 6px;
}
.range-sep {
  opacity: 0.5;
  font-size: 12px;
}
</style>
