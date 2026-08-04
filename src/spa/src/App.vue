<template>
  <Masthead />
  <div class="frame">
    <SideBar />
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Masthead from '@/components/layout/Masthead.vue'
import SideBar from '@/components/layout/SideBar.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(() => {
  userStore.init()
})
</script>

<style scoped>
</style>
