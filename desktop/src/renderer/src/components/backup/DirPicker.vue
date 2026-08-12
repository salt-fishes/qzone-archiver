<script setup lang="ts">
/** 保存位置选择（S3 步骤②）：选择备份目标文件夹，持久化到 config.targetDir */
import { useConfigStore } from '../../stores/config';

const { targetDir, pickDir, openFolder } = useConfigStore();
</script>

<template>
  <div class="dir-picker">
    <p class="dp-desc">备份文件会保存在你选择的文件夹中，完成后可随时回看，不会上传到任何地方。</p>
    <div class="dir-row">
      <input :value="targetDir" class="dir-input" placeholder="尚未设置保存位置，点击「选择」" readonly />
      <button class="btn primary" @click="pickDir">选择</button>
      <button v-if="targetDir" class="btn" @click="openFolder">打开</button>
    </div>
    <p v-if="!targetDir" class="dp-hint">推荐保存到「我的文档」下的专用文件夹，方便查找与管理。</p>
  </div>
</template>

<style scoped>
.dp-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.7;
}
.dp-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}
</style>
