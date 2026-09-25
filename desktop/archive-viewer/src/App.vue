<template>
  <!-- 全屏路由（年度报告）：隐藏顶栏与侧栏，独立沉浸式页面 -->
  <template v-if="isFullscreen">
    <RouterView />
  </template>

  <!-- 常规布局：报头 + 卷目 + 内容 -->
  <template v-else>
    <Masthead />
    <div class="frame">
      <SideBar />
      <main class="content">
        <RouterView v-slot="{ Component }">
          <!-- 路由切换：交叉淡入淡出（§3.1，整页扫版转场明确不做） -->
          <Transition name="route" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Masthead from '@/components/layout/Masthead.vue'
import SideBar from '@/components/layout/SideBar.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

/** 全屏路由：不渲染顶栏/侧栏，页面自管布局 */
const isFullscreen = computed(() => !!route.meta.fullscreen)

onMounted(() => {
  userStore.init()
})
</script>

<style scoped>
/* 路由交叉淡入淡出（--dur-2） */
.route-enter-active,
.route-leave-active {
  transition: opacity var(--dur-2) var(--ease-out);
}

.route-enter-from,
.route-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .route-enter-active,
  .route-leave-active {
    transition: none;
  }
}
</style>
