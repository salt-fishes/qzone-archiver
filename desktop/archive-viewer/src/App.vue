<template>
  <!-- 全屏路由（年度报告）：隐藏顶栏与侧栏，独立沉浸式页面 -->
  <template v-if="isFullscreen">
    <RouterView />
  </template>

  <!-- 常规布局：顶栏 + 左侧导航 + 内容 -->
  <template v-else>
    <Masthead />
    <div class="frame">
      <SideBar />
      <main class="content">
        <RouterView />
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
</style>
