<template>
  <section class="not-found">
    <div class="section-head">
      <span class="section-num">404</span>
      <h2 class="section-title">未找到档案</h2>
      <span class="section-meta">Not Found</span>
    </div>

    <div class="placeholder">
      <p class="placeholder-text">您访问的页面不存在或尚未归档。</p>
      <RouterLink to="/" class="btn" style="margin-top: 24px;">返回首页</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.placeholder {
  padding: var(--sp-5);
  border: var(--line-dot);
  background: rgba(255, 255, 255, 0.2);
}

.placeholder-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  color: var(--ink);
}
</style>
