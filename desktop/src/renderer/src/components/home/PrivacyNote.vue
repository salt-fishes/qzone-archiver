<template>
  <div class="privacy">
    <svg
      class="privacy-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
    <span>数据只保存在你的电脑上 · 建议间隔一段时间备份一次</span>
  </div>
</template>

<style scoped>
.privacy {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-soft);
}
.privacy-ico {
  width: 15px;
  height: 15px;
  color: var(--accent);
  flex-shrink: 0;
}
</style>
