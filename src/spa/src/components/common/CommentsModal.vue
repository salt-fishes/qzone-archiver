<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Comments"
    size="lg"
    @close="$emit('close')"
  >
    <div v-if="loading" class="loading-tip">加载中…</div>
    <div v-else-if="!comments.length" class="empty-tip">暂无评论</div>
    <ol v-else ref="commentTreeRef" class="comment-tree">
      <li v-for="(c, i) in comments" :key="commentKey(c, i)" class="comment-item">
        <!-- 一级评论 -->
        <div class="comment-level-1">
          <div class="comment-avatar">
            <img
              v-if="avatarUrl(c)"
              :src="avatarUrl(c)"
              :data-uin="uinOf(c) || ''"
              :alt="name(c)"
              loading="lazy"
              @error="onAvatarError"
            />
            <span v-else class="comment-avatar-placeholder">{{ (name(c) || '?')[0] }}</span>
          </div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-name">{{ name(c) }}</span>
              <span v-if="uinOf(c)" class="comment-uin">№ {{ uinOf(c) }}</span>
              <span class="comment-time">{{ formatTime(c) }}</span>
            </div>
            <div class="comment-text" v-html="formatContent(c.content || '（无内容）')"></div>
            <MediaGrid
              v-if="commentMedia(c).length"
              :media-items="commentMedia(c)"
              class="comment-media"
            />
          </div>
        </div>

        <!-- 二级回复（list_3） -->
        <ol v-if="c.list_3 && c.list_3.length" class="comment-level-2">
          <li v-for="(r, j) in c.list_3" :key="commentKey(r, j)" class="comment-reply">
            <div class="comment-avatar small">
              <img
                v-if="avatarUrl(r)"
                :src="avatarUrl(r)"
                :data-uin="uinOf(r) || ''"
                :alt="name(r)"
                loading="lazy"
                @error="onAvatarError"
              />
              <span v-else class="comment-avatar-placeholder">{{ (name(r) || '?')[0] }}</span>
            </div>
            <div class="comment-body">
              <div class="comment-meta">
                <span class="comment-name">{{ name(r) }}</span>
                <span v-if="uinOf(r)" class="comment-uin">№ {{ uinOf(r) }}</span>
                <span class="comment-time">{{ formatTime(r) }}</span>
              </div>
              <div class="comment-text" v-html="formatContent(r.content || '（无内容）', { plainMentions: true })"></div>
              <MediaGrid
                v-if="commentMedia(r).length"
                :media-items="commentMedia(r)"
                class="comment-media"
              />
            </div>
          </li>
        </ol>
      </li>
    </ol>
    <template #footer>
      <span class="meta">共 {{ comments.length }} 条评论</span>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalDialog from './ModalDialog.vue'
import MediaGrid, { type MediaItem } from './MediaGrid.vue'
import { formatContent, resolveModulePath, buildQzoneAvatarUrl, resolveCommonImagePath } from '@/utils/formatContent'
import type { Comment } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  comments: Comment[]
  loading?: boolean
  count?: number
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const titleText = computed(() => {
  const c = props.count ?? props.comments.length
  return `评论列表 · ${c}`
})

function name(c: Comment): string {
  const p = c.poster
  return p?.name || p?.nick || p?.nickname || c.nick || c.name || '匿名'
}

function uinOf(c: Comment): string | number | undefined {
  return c.uin || c.poster?.uin || c.poster?.id
}

function avatarUrl(c: Comment): string {
  const direct = (c as any).portrait || (c as any).avatar || ''
  if (direct && /^https?:/.test(direct)) return direct
  if (direct && direct.startsWith('//')) return 'https:' + direct
  // 无直链头像时，用 uin 指向本地已下载头像（Common/images/{uin}），缺失时 @error 回退在线 qlogo
  const uin = uinOf(c)
  return uin ? resolveCommonImagePath(`Common/images/${uin}`) : ''
}

function onAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  const src = img.src
  if (src.includes('qlogo') || src.startsWith('data:')) {
    // 在线头像也失败：隐藏，避免破图
    img.style.display = 'none'
    return
  }
  // 本地文件缺失 → 换成在线 qlogo 头像
  const uin = (img as any).dataset?.uin || ''
  if (uin) img.src = buildQzoneAvatarUrl(uin)
  else img.style.display = 'none'
}

function formatTime(c: Comment): string {
  if (c.custom_create_time) return c.custom_create_time
  const ts = c.create_time || c.postTime
  if (ts) {
    const d = new Date(Number(ts) * 1000)
    if (!Number.isNaN(d.getTime())) return d.toISOString().replace('T', ' ').substring(0, 16)
  }
  return '——'
}

/** 提取评论图片，按 custom_filepath > custom_url > o_url > hd_url > b_url > s_url > url1 优先级 */
function commentMedia(c: Comment): MediaItem[] {
  const pics = (c as any).pic || (c as any).custom_pic || []
  return pics.map((p: any) => {
    // 优先本地路径 custom_filepath（已下载到 Messages/images/）
    const local = p.custom_filepath ? resolveModulePath(p.custom_filepath, 'Messages') : ''
    const remoteSrc = p.custom_url || p.o_url || p.hd_url || p.b_url || p.url1 || ''
    const remoteThumb = p.s_url || p.smallurl || p.url3 || p.b_url || p.url1 || ''
    return {
      src: local || remoteSrc,
      thumb: local || remoteThumb,
      type: 'image' as const
    }
  }).filter((m: MediaItem) => m.src && m.thumb)
}

function commentKey(c: Comment, i: number): string {
  return c.id ? String(c.id) : `k${i}`
}
</script>

<style scoped>
.comment-tree {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.comment-item {
  border-left: 3px solid var(--ink);
  padding-left: var(--sp-4);
  padding-top: var(--sp-1);
  padding-bottom: var(--sp-1);
}

.comment-level-1 {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: var(--sp-3);
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: var(--line);
  overflow: hidden;
  background: var(--paper-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comment-avatar.small {
  width: 28px;
  height: 28px;
}

.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-avatar-placeholder {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-2);
}

.comment-body {
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-1);
  flex-wrap: wrap;
}

.comment-name {
  font-family: var(--font-serif-cn);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ink);
}

.comment-uin,
.comment-time {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-3);
}

.comment-text {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-text :deep(.mention) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  font-weight: 500;
  text-decoration: none;
}

.comment-text :deep(.mention:hover) {
  color: var(--vermilion);
}

/* 二级评论的 @ 提及：纯文本样式，无跳转链接 */
.comment-text :deep(.mention-text) {
  color: var(--indigo);
  font-weight: 500;
}

.comment-text :deep(.emoticon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.comment-media {
  margin-top: var(--sp-2);
}

/* 二级回复列表 */
.comment-level-2 {
  list-style: none;
  margin-top: var(--sp-2);
  margin-left: calc(var(--sp-4) + 40px);
  padding-left: var(--sp-3);
  border-left: var(--line-dot);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.comment-reply {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: var(--sp-2);
  padding: var(--sp-1) 0;
  position: relative;
}

.comment-reply::before {
  content: '↳';
  position: absolute;
  left: -1.2rem;
  top: 0;
  font-family: var(--font-mono);
  color: var(--vermilion);
  font-size: 0.85rem;
}

.loading-tip,
.empty-tip {
  padding: var(--sp-5);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
}

@media (max-width: 600px) {
  .comment-level-1 {
    grid-template-columns: 32px 1fr;
    gap: var(--sp-2);
  }
  .comment-avatar {
    width: 32px;
    height: 32px;
  }
  .comment-level-2 {
    margin-left: var(--sp-4);
  }
  /* 移动端扩大点击区域 */
  .comment-item {
    padding-left: var(--sp-4);
    padding-top: var(--sp-3);
    padding-bottom: var(--sp-3);
  }
  .comment-reply {
    padding: var(--sp-2) 0;
    gap: var(--sp-2);
  }
  .comment-name {
    font-size: 0.95rem;
  }
  .comment-text {
    font-size: 0.95rem;
  }
  /* 二级回复头像稍大，避免误触 */
  .comment-avatar.small {
    width: 32px;
    height: 32px;
  }
}
</style>
