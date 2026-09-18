<script setup lang="ts">
/**
 * 向导第①步：选择备份目标（v4.6 他人模式）
 * 我的空间 / 好友的空间 两个入口；好友模式 = QQ 号输入 + 好友远程搜索 + 空间可访问性校验
 */
import { computed, h, ref } from 'vue';
import { NInput, NSelect, NButton, NAlert, NSpin } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { useTargetStore } from '../../stores/target';
import { useAuthStore } from '../../stores/auth';
import EmoticonText from '../common/EmoticonText.vue';
import TargetAvatar from '../common/TargetAvatar.vue';

const target = useTargetStore();
const { auth } = useAuthStore();

const TYPE_SELF = 'M8 10V7a4 4 0 0 1 8 0v3 M5 10h14v10H5V10Z M10 14h4';
const TYPE_OTHER = 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20c0-3 2.7-5 6-5s6 2 6 5 M16 8a3 3 0 1 0 0-6 M21 20c0-2.4-1.6-4.3-4-4.8';

const OPTIONS = [
  { key: 'self', title: '我的空间', desc: '备份登录账号的全部内容，包括日记、收藏等私密内容', icon: TYPE_SELF },
  { key: 'other', title: '好友的空间', desc: '输入好友 QQ 号，备份其公开的说说、相册、日志等内容', icon: TYPE_OTHER },
] as const;

const manualUin = ref('');

const friendOptions = computed(() =>
  target.friends.map((f) => ({
    label: `${f.remark || f.nickname || '好友'}（${f.uin}）`,
    value: f.uin,
    remark: f.remark,
    nickname: f.nickname,
  }))
);

/**
 * 下拉选项里的昵称同样要把 `[em]e123[/em]` 渲染成图片（v4.7.5）：
 * NSelect 的 options.label 是纯字符串，必须用 render-label 才能塞组件。
 */
function renderFriendLabel(option: SelectOption) {
  const name = String(option.remark || option.nickname || '好友');
  return [
    h(EmoticonText, { text: name, size: 15 }),
    h('span', { class: 'fo-uin' }, `（${String(option.value ?? '')}）`),
  ];
}

const friendPlaceholder = computed(() =>
  target.friends.length
    ? `或从好友列表选择（${target.friends.length} 位好友，备注 / 昵称 / QQ 号搜索）`
    : '或从好友列表选择（备注 / 昵称 / QQ 号搜索）'
);

/** 显示中的目标 QQ 号（输入框 / 下拉选中同步） */
const draftUin = computed({
  get: () => target.inputUin || manualUin.value,
  set: (v: string) => {
    manualUin.value = v;
    target.inputUin = v.replace(/\D/g, '');
    target.profile = null;
    target.validateError = '';
  },
});

function pick(uin: string) {
  target.pickFriend(uin);
  manualUin.value = uin;
}

async function doValidate() {
  await target.validate();
}
</script>

<template>
  <div class="target-picker">
    <div class="type-cards">
      <button
        v-for="o in OPTIONS"
        :key="o.key"
        class="type-card"
        :class="{ active: target.mode === o.key }"
        @click="target.setMode(o.key)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path :d="o.icon" />
        </svg>
        <span class="tc-title">{{ o.title }}</span>
        <span class="tc-desc">{{ o.desc }}</span>
      </button>
    </div>

    <!-- 他人模式：QQ 号输入 + 好友搜索 + 校验 -->
    <template v-if="target.mode === 'other'">
      <NAlert
        v-if="!target.profile"
        type="warning"
        :show-icon="true"
        class="val-alert"
      >
        请输入或选择好友 QQ 号后，先点击「校验」确认对方空间可以访问；校验通过后才能进入下一步。
      </NAlert>
      <div class="other-form">
        <div class="form-row">
          <NInput
            v-model:value="draftUin"
            placeholder="输入好友 QQ 号"
            size="large"
            :maxlength="12"
            :disabled="target.validating"
            class="uin-input"
          />
          <NButton
            type="primary"
            size="large"
            :loading="target.validating"
            @click="doValidate"
          >
            校验
          </NButton>
        </div>

        <div class="form-row">
          <NSelect
            filterable
            clearable
            :options="friendOptions"
            :loading="target.friendsLoading"
            :value="target.inputUin || null"
            :placeholder="friendPlaceholder"
            :render-label="renderFriendLabel"
            size="large"
            @update:value="(v: string | null) => v && pick(v)"
          >
            <template #empty>
              {{ target.friendsLoading ? '正在加载好友列表…' : '没有可选好友' }}
            </template>
          </NSelect>
        </div>

        <!-- 好友列表加载失败/为空：原因可见 + 一键重试 -->
        <div
          v-if="target.friendsError && !target.friendsLoading"
          class="friends-state"
        >
          <span class="fs-text">{{ target.friendsError }}</span>
          <NButton
            size="tiny"
            quaternary
            type="primary"
            @click="target.loadFriends(true)"
          >
            重新加载
          </NButton>
        </div>

        <NAlert
          v-if="target.validateError"
          type="error"
          :show-icon="true"
          class="val-alert"
        >
          {{ target.validateError }}
        </NAlert>

        <NSpin :show="target.validating">
          <div
            v-if="target.profile"
            class="profile-card"
          >
            <TargetAvatar
              :uin="target.profile.uin"
              :label="target.profile.nickname"
              :size="44"
            />
            <div class="pc-info">
              <div class="pc-name">
                <EmoticonText
                  v-if="target.profile.nickname"
                  :text="target.profile.nickname"
                  :size="16"
                />
                <template v-else>{{ target.profile.uin }}</template>
                <NTag
                  v-if="target.profile.isOwner"
                  size="tiny"
                  round
                  :bordered="false"
                >
                  这就是你
                </NTag>
              </div>
              <div class="pc-uin">
                QQ {{ target.profile.uin }} · 空间可访问
              </div>
            </div>
          </div>
        </NSpin>

        <NAlert
          type="warning"
          :show-icon="true"
          class="val-alert"
        >
          将以普通访客身份访问对方公开内容，会留下访客记录；日记、收藏等私密内容无法备份。
        </NAlert>
      </div>
    </template>

    <!-- 本人模式：显示登录账号卡片（§A：无昵称时主行 QQ 号、副行只写「已登录」，不再两行 QQ 号） -->
    <div
      v-else
      class="profile-card self"
    >
      <TargetAvatar
        :uin="auth.qqNumber"
        :label="auth.nickname || auth.qqNumber"
        :size="44"
      />
      <div class="pc-info">
        <div class="pc-name">
          <EmoticonText
            v-if="auth.nickname"
            :text="auth.nickname"
            :size="16"
          />
          <template v-else-if="auth.loggedIn">
            QQ {{ auth.qqNumber || '—' }}
          </template>
          <template v-else>未登录</template>
        </div>
        <div class="pc-uin">
          {{ !auth.loggedIn ? '请先在顶栏扫码登录' : auth.nickname ? `QQ ${auth.qqNumber} · 已登录` : '已登录' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.target-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.type-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 700px) {
  .type-cards {
    grid-template-columns: 1fr;
  }
}
.type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1.5px solid var(--surface-border);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast) ease, background var(--dur-fast) ease, transform var(--dur-fast) var(--ease-out);
}
.type-card:hover {
  transform: translateY(-1px);
  border-color: rgba(180, 95, 61, 0.5);
}
.type-card.active {
  border-color: #b45f3d;
  background: rgba(180, 95, 61, 0.08);
}
.type-card svg {
  width: 22px;
  height: 22px;
  color: #b45f3d;
  margin-bottom: 2px;
}
.tc-title {
  font-size: 14.5px;
  font-weight: 600;
}
.tc-desc {
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.55;
}
.other-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-row {
  display: flex;
  gap: 10px;
}
.form-row > :first-child {
  flex: 1;
}
.uin-input :deep(input) {
  font-family: var(--mono-font);
}
.friends-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(240, 160, 32, 0.1);
  font-size: 12px;
  color: #f0a020;
}
.fs-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.val-alert {
  --n-padding: 10px 14px;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
}
.profile-card.self {
  border-style: dashed;
}
.pc-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
  font-weight: 600;
}
.pc-uin {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.55;
}
</style>
