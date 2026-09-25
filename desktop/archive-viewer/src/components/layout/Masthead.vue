<template>
  <header ref="mastheadRef" class="masthead">
    <div class="masthead-grid">
      <div class="masthead-left">
        <template v-if="userStore.isReady">
          <span class="meta">Personal Archive</span>
          <span class="meta">{{ issueLabel }}</span>
        </template>
        <template v-else>
          <div class="skeleton skeleton-line" style="width: 120px;"></div>
          <div class="skeleton skeleton-line" style="width: 80px;"></div>
        </template>
      </div>
      <div class="masthead-center">
        <h1 class="masthead-title">QQ空间<em>档案</em></h1>
        <template v-if="userStore.isReady">
          <div class="masthead-sub">Est. 2005 · {{ nickname || 'Archive' }}</div>
        </template>
        <template v-else>
          <div class="skeleton skeleton-line" style="width: 180px; margin: var(--sp-2) auto;"></div>
        </template>
      </div>
      <div class="masthead-right">
        <template v-if="userStore.isReady">
          <span class="meta">№ {{ uin || '——' }}</span>
          <span class="meta">共 <span ref="countRef">{{ totalRecords.toLocaleString() }}</span> 条记录</span>
        </template>
        <template v-else>
          <div class="skeleton skeleton-line" style="width: 90px;"></div>
          <div class="skeleton skeleton-line" style="width: 110px;"></div>
        </template>
      </div>
    </div>
    <NavBar />
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import NavBar from './NavBar.vue'

const userStore = useUserStore()

const uin = computed(() => userStore.uin)
const nickname = computed(() => userStore.nickname)
const totalRecords = computed(() => userStore.totalRecords)

const mastheadRef = ref<HTMLElement | null>(null)
const countRef = ref<HTMLElement | null>(null)

const issueLabel = computed(() => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `Vol. ${year} · No.${month}`
})

onMounted(() => {
  if (!userStore.isReady) userStore.init()
})

// 记录总数就绪后数字直接显示
watch(() => userStore.totalRecords, (v) => {
  if (v > 0 && countRef.value) {
    countRef.value.textContent = v.toLocaleString()
  }
})
</script>

<style scoped>
.masthead {
  border-bottom: var(--line-double);
  padding: var(--sp-6) var(--sp-7) var(--sp-4);
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, var(--paper) 0%, transparent 100%);
}

.masthead-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: var(--sp-5);
  max-width: 1400px;
  margin: 0 auto;
}

.masthead-left,
.masthead-right {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.masthead-right {
  text-align: right;
  align-items: flex-end;
}

.masthead-center {
  text-align: center;
}

.masthead-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 0.95;
  text-align: center;
}

.masthead-title em {
  font-style: italic;
  color: var(--vermilion);
  font-weight: 600;
}

.masthead-sub {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-top: var(--sp-2);
}

/* 移动端：压缩顶部导航高度与边距（侧边距由 48px 降至 12px，标题缩小约 60%） */
@media (max-width: 900px) {
  .masthead {
    padding: var(--sp-2) var(--sp-3) var(--sp-2);
  }
  .masthead-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-1);
  }
  .masthead-center {
    order: -1;
  }
  .masthead-left,
  .masthead-right {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--sp-3);
    font-size: 0.6rem;
    text-align: center;
  }
  .masthead-title {
    font-size: 1.3rem;
    letter-spacing: -0.01em;
  }
  .masthead-sub {
    font-size: 0.55rem;
    letter-spacing: 0.12em;
    margin-top: var(--sp-1);
  }
}
</style>
