<script setup lang="ts">
/** 通用确认弹层（危险操作 / 未保存离开等） */
defineProps<{
  show: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div v-if="show" class="overlay cd-overlay" @click.self="emit('cancel')">
    <div class="confirm-dialog">
      <h3 class="cd-title">{{ title }}</h3>
      <p v-if="message" class="cd-msg">{{ message }}</p>
      <div class="cd-actions">
        <button class="btn" @click="emit('cancel')">{{ cancelText || '取消' }}</button>
        <button class="btn" :class="danger ? 'danger' : 'primary'" @click="emit('confirm')">
          {{ confirmText || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-overlay {
  align-items: center;
  z-index: 200;
}
.confirm-dialog {
  width: 100%;
  max-width: 360px;
  background: var(--card);
  border-radius: 12px;
  padding: 22px 24px;
  box-shadow: 0 12px 44px rgba(40, 30, 15, 0.3);
  animation: fadeUp 0.25s ease both;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.cd-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.cd-msg {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-soft);
}
.cd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
