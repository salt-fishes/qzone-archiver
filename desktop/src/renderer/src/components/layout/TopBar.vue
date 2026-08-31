<script setup lang="ts">
/** 顶栏：品牌 + 连接状态（正常/加载中/失败可重试）+ 登录态（导航收敛后仅保留状态与身份） */
defineProps<{
  appInfo: { version?: string };
  engineReady: boolean;
  engineFailed?: boolean;
  auth: { loggedIn: boolean; nickname?: string; qqNumber?: string };
}>();

const emit = defineEmits<{
  login: [];
  logout: [];
  retry: [];
  openEngine: [];
}>();
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="seal">檔</span>
      <div class="brand-text">
        <span class="brand-title">QQ空间档案备份</span>
        <span class="ver">v{{ appInfo.version }}</span>
      </div>
    </div>
    <div class="topmeta">
      <button
        v-if="engineFailed"
        class="engine err"
        title="点击重新连接"
        @click="emit('retry')"
      >
        <i class="dot" />连接失败 · 点击重试
      </button>
      <span
        v-else
        class="engine"
        :class="engineReady ? 'on' : 'off'"
        :title="engineReady ? '已连接 QQ 空间' : '正在准备备份引擎，请稍候…'"
      >
        <i class="dot" />{{ engineReady ? '连接正常' : '连接中…' }}
      </span>
      <span class="vline" />
      <template v-if="auth.loggedIn">
        <span class="who">{{ auth.nickname || auth.qqNumber }}</span>
        <button
          class="btn ghost sm"
          title="打开 QQ 空间页面（登录后如需访问他人空间）"
          @click="emit('openEngine')"
        >
          QQ 空间
        </button>
        <button
          class="btn ghost sm"
          @click="emit('logout')"
        >
          退出登录
        </button>
      </template>
      <template v-else>
        <span class="who off">未登录</span>
        <button
          class="btn primary sm"
          @click="emit('login')"
        >
          扫码登录
        </button>
      </template>
    </div>
  </header>
</template>
