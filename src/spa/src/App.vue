<template>
  <Masthead />
  <div class="frame">
    <SideBar />
    <main class="content">
      <RouterView v-slot="{ Component }">
        <transition
          name="fade"
          mode="out-in"
          @before-enter="beforeEnter"
          @enter="enter"
          @leave="leave"
        >
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Masthead from '@/components/layout/Masthead.vue'
import SideBar from '@/components/layout/SideBar.vue'
import { useUserStore } from '@/stores/user'
import { anime, reducedMotion, staggerEnter } from '@/composables/useMotion'

const userStore = useUserStore()

onMounted(() => {
  userStore.init()
})

// ============ 路由过渡（anime 驱动） ============
// 容器仅淡入；视图内部的章节标题在 enter 完成后级联入场，
// 与 VirtualList 首屏 stagger 错开（列表自带 delay），保证标题先浮现
function beforeEnter(el: Element) {
  if (reducedMotion()) return
  anime.set(el, { opacity: 0 })
}

function enter(el: Element, done: () => void) {
  if (reducedMotion()) {
    anime.set(el, { opacity: 1 })
    done()
    return
  }
  anime({
    targets: el,
    opacity: 1,
    duration: 280,
    easing: 'easeOutCubic',
    complete: () => {
      // 视图章节标题（§编号 / 标题 / meta）交错浮现
      staggerEnter(el, '.section-head', { gap: 100, translateY: 18, scale: 0.98, duration: 680 })
      done()
    }
  })
}

function leave(el: Element, done: () => void) {
  if (reducedMotion()) {
    done()
    return
  }
  anime({
    targets: el,
    opacity: 0,
    translateY: -6,
    duration: 160,
    easing: 'easeInQuad',
    complete: done
  })
}
</script>

<style scoped>
/* 过渡完全由 anime.js JS hooks 驱动，无需 CSS transition 类 */
</style>
