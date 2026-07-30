<template>
  <header class="masthead">
    <div class="masthead-grid">
      <div class="masthead-left">
        <span class="meta">Personal Archive</span>
        <span class="meta">{{ issueLabel }}</span>
      </div>
      <div class="masthead-center">
        <h1 class="masthead-title">QQ空间<em>档案</em></h1>
        <div class="masthead-sub">Est. 2005 · {{ nickname || 'Archive' }}</div>
      </div>
      <div class="masthead-right">
        <span class="meta">№ {{ uin || '——' }}</span>
        <span class="meta">共 {{ totalRecords.toLocaleString() }} 条记录</span>
      </div>
    </div>
    <NavBar />
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import NavBar from './NavBar.vue'

const userStore = useUserStore()

const uin = computed(() => userStore.uin)
const nickname = computed(() => userStore.nickname)
const totalRecords = computed(() => userStore.totalRecords)

const issueLabel = computed(() => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `Vol. ${year} · No.${month}`
})

onMounted(() => {
  if (!userStore.isReady) userStore.init()
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
  animation: ink-spread 1s ease-out both;
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

@keyframes ink-spread {
  from { opacity: 0; letter-spacing: 0.3em; }
  to { opacity: 1; letter-spacing: -0.03em; }
}

@media (max-width: 900px) {
  .masthead-grid {
    grid-template-columns: 1fr;
  }
  .masthead-left,
  .masthead-right {
    text-align: center;
    align-items: center;
  }
}
</style>
