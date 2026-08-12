<script setup lang="ts">
/** 备份向导步骤条（S3）：①选择内容 → ②保存位置 → ③开始备份 */
defineProps<{ current: number }>();

const STEPS = [
  { title: '选择内容', desc: '勾选要备份的模块' },
  { title: '保存位置', desc: '备份文件存到哪里' },
  { title: '开始备份', desc: '确认并开始' },
];
</script>

<template>
  <ol class="steps">
    <li
      v-for="(s, i) in STEPS"
      :key="i"
      :class="{ on: current === i + 1, done: current > i + 1 }"
    >
      <span class="step-num">{{ i + 1 }}</span>
      <div class="step-txt">
        <b>{{ s.title }}</b>
        <span>{{ s.desc }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.steps {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--card);
  overflow: hidden;
}
.steps li {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: var(--ink-soft);
  border-right: 1px solid var(--line-soft);
}
.steps li:last-child {
  border-right: none;
}
.step-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-family: Consolas, monospace;
  background: #faf3e3;
}
.step-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.step-txt b {
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
}
.step-txt span {
  font-size: 11px;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.steps li.done .step-num {
  background: var(--ok);
  border-color: var(--ok);
  color: #fff;
}
.steps li.done .step-txt b {
  color: var(--ok);
}
.steps li.on .step-num {
  background: var(--accent);
  border-color: var(--accent);
  color: #fbe9d8;
}
.steps li.on .step-txt b {
  color: var(--accent-deep);
}
@media (max-width: 640px) {
  .step-txt span {
    display: none;
  }
}
</style>
