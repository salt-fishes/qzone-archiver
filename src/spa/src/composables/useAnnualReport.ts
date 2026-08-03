/**
 * 年度档案（年报）数据聚合与文案生成
 *
 * 数据来源：全部来自现有 Pinia store 的轻量索引（messages/photos/friends + user.stats），
 * 内容类统计（金句、年度词）按需加载各年份全量数据（loadDetail）。
 *
 * 文案设计：每个章节根据数据特征（数值区间 / 时间特征 / 互动情况）输出不同分支的
 * 温馨文案，第二人称"你"，延续档案馆情怀基调。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useUserStore } from '@/stores/user'
import { usePhotosStore } from '@/stores/photos'
import { useFriendsStore } from '@/stores/friends'
import type { MessageIndex, AlbumIndex, FriendIndex } from '@/types'

/* ==================== 类型 ==================== */

/** 年报某一章的渲染数据 */
export interface ReportChapter {
  id: string
  /** 章节序号（如 § 03） */
  num: string
  /** 主标题 */
  title: string
  /** 温馨正文（可含 <em> 强调，页面 v-html 渲染） */
  text: string
  /** 强调数字（展示于标题旁） */
  accent?: string
  /** 章节额外数据（供页面绘制图形，如柱状图） */
  data?: any
}

/** 索引级统计（纯轻量索引即可算出） */
export interface AnnualStats {
  year: number | 'all'
  nickname: string
  uin: string
  totalMessages: number
  spanYears: number
  firstYear: number | null
  lastYear: number | null
  firstMessage: MessageIndex | null
  lastMessage: MessageIndex | null
  yearCounts: { year: number; count: number }[]
  topYear: { year: number; count: number } | null
  monthCounts: number[]
  topMonth: number | null
  hourCounts: number[]
  /** 深夜（22:00-05:59）占比 0-1 */
  nightRatio: number
  /** 清晨（06:00-09:59）占比 0-1 */
  dawnRatio: number
  /** 索引 title 中最长的一条 */
  longestTitle: MessageIndex | null
  topComment: MessageIndex | null
  topLike: MessageIndex | null
  totalPhotos: number
  topAlbums: AlbumIndex[]
  earliestAlbum: AlbumIndex | null
  friendTotal: number
  earliestFriend: FriendIndex | null
  /** 亲密度最高的好友（intimacyScore 最大，可能为 null） */
  topIntimacyFriend: FriendIndex | null
}

/** 需要加载全量数据后才能算出的内容（按当前年度计算） */
export interface AnnualDetail {
  /** 已加载的说说全文（去 HTML）列表 */
  contents: string[]
  /** 全文中最长的一条 */
  longestContent: { text: string; time: string; tid: string; year: number } | null
  /** 高频词 Top（双字词） */
  words: { word: string; count: number }[]
  /** 说说中互动最多的人（评论/点赞者出现频次） */
  topInteractor: { uin: string; name: string; count: number } | null
  /** 特别的日子：按主题识别的说说（生日 / 跨年 / 节日 / 大事等） */
  specialDays: SpecialDay[]
}

/** 特别的日子条目 */
export interface SpecialDay {
  key: string
  /** 主题标签（如 生日） */
  label: string
  /** 主题标记符号 */
  mark: string
  text: string
  time: string
  tid: string
  year: number
}

/** 特别的日子主题识别规则 */
const SPECIAL_TOPICS: { key: string; label: string; mark: string; keywords: string[] }[] = [
  { key: 'birthday', label: '生日', mark: '♡', keywords: ['生日'] },
  { key: 'newyear', label: '跨年', mark: '✷', keywords: ['新年', '跨年', '元旦'] },
  { key: 'festival', label: '节日', mark: '◉', keywords: ['情人节', '圣诞节', '圣诞', '中秋', '国庆', '端午', '七夕'] },
  { key: 'milestone', label: '大事', mark: '✎', keywords: ['毕业', '高考', '入职', '上班', '搬家', '结婚'] }
]

/** 全量说说原文（按年组织，供按年度重新聚合） */
interface RawMessage {
  year: number
  tid: string
  text: string
  time: string
  /** 该说说下的互动者（评论/点赞） */
  interactors: { uin: string; name: string }[]
}

/* ==================== 工具 ==================== */

const STOP_WORDS = new Set([
  '我们','你们','他们','她们','它们','这个','那个','一个','什么','可以','没有','自己',
  '今天','现在','已经','时候','这样','那样','就是','不是','然后','所以','因为','如果',
  '还是','只是','知道','觉得','真的','其实','有点','一下','起来','一起','一直','这么',
  '那么','不会','不要','谢谢','哈哈','可以','怎么','多少','时间','生活','世界','大家',
  '朋友','希望','喜欢','开始','感觉','还有','还是','那里','这里','突然','总是','一次',
  '以后','过去','晚上','早上','下午','中午','昨天','明天','大家','快乐','真的','非常'
])

function parseTime(t?: string): Date | null {
  if (!t) return null
  // 形如 'YYYY-MM-DD HH:mm:ss'，将 - 换 / 避免 iOS 解析失败
  const d = new Date(t.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? null : d
}

function cnNum(n: number): string {
  const map = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 10) return map[n]
  if (n < 20) return `十${n > 10 ? map[n - 10] : ''}`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return `${map[tens]}十${ones > 0 ? map[ones] : ''}`
  }
  return String(n)
}

/**
 * 基于「左右信息熵」的无监督分词统计
 *
 * 双字组 bigram 直接按频次排序会产生大量跨词边界碎片（如"往里"被"往里走"切出）。
 * 真词（如"生日快乐"）出现时两侧上下文多样（左右熵高）；碎片总被固定字符包围（熵低）。
 * 因此按「出现次数 × (左熵 + 右熵)」排序，并过滤低熵碎片。
 */
function buildWordFreq(texts: string[]): { word: string; count: number }[] {
  const freq = new Map<string, number>()
  const leftCtx = new Map<string, Map<string, number>>()
  const rightCtx = new Map<string, Map<string, number>>()
  const joined = texts.join('\n').replace(/<[^>]+>/g, ' ')
  const chunks = joined.match(/[\u4e00-\u9fa5]+/g) || []
  for (const chunk of chunks) {
    if (chunk.length < 2) continue
    for (let i = 0; i < chunk.length - 1; i++) {
      const w = chunk.slice(i, i + 2)
      freq.set(w, (freq.get(w) || 0) + 1)
      const lc = chunk[i - 1] || '\u0000'
      const rc = chunk[i + 2] || '\u0000'
      if (!leftCtx.has(w)) leftCtx.set(w, new Map())
      if (!rightCtx.has(w)) rightCtx.set(w, new Map())
      leftCtx.get(w)!.set(lc, (leftCtx.get(w)!.get(lc) || 0) + 1)
      rightCtx.get(w)!.set(rc, (rightCtx.get(w)!.get(rc) || 0) + 1)
    }
  }
  const entropy = (m: Map<string, number> | undefined): number => {
    if (!m || m.size < 2) return 0
    let total = 0
    m.forEach(v => (total += v))
    let e = 0
    m.forEach(v => {
      const p = v / total
      e -= p * Math.log(p)
    })
    return e
  }
  const scored: { word: string; count: number; le: number; re: number }[] = []
  freq.forEach((count, w) => {
    if (STOP_WORDS.has(w) || count < 2) return
    const le = entropy(leftCtx.get(w))
    const re = entropy(rightCtx.get(w))
    // 两侧熵均较高（真词）或单侧极高时保留，过滤固定搭配碎片
    if (Math.min(le, re) >= 0.8 || Math.max(le, re) >= 1.6) {
      scored.push({ word: w, count, le, re })
    }
  })
  scored.sort((a, b) => b.count * (b.le + b.re) - a.count * (a.le + a.re))
  return scored.slice(0, 12).map(({ word, count }) => ({ word, count }))
}

/** 去除说说内容中的 QQ 表情标记 [em]e401438[/em] */
function stripEm(text: string): string {
  return (text || '').replace(/\[em\]e\d+\[\/em\]/g, '').replace(/\[em\]\[\/em\]/g, '').replace(/\s+/g, ' ').trim()
}

/* ==================== 文案生成 ==================== */

/** §01 封面 */
function describeCover(s: AnnualStats): ReportChapter {
  const span = s.spanYears
  let text: string
  let title: string
  if (span >= 10) {
    title = '十年的青春'
    text = `从 ${s.firstYear} 到 ${s.lastYear}，${cnNum(span)}年。你把青春、心事与日常，一份份妥帖地收进了这里。<em>时间没有走远，它只是换了一种方式陪着你。</em>`
  } else if (span >= 5) {
    title = '多年的陪伴'
    text = `从 ${s.firstYear} 到 ${s.lastYear}，${cnNum(span)}年光阴。这座城市、这些人、这些日子里，有你认真生活过的痕迹。<em>谢谢你还愿意保存它们。</em>`
  } else if (span >= 2) {
    title = '岁月的开始'
    text = `从 ${s.firstYear} 到 ${s.lastYear}，${cnNum(span)}年。故事不算很长，但每一页都写满了「你」。<em>愿你往后的档案，越积越厚。</em>`
  } else if (span === 1) {
    title = '这一年的你'
    text = `从 ${s.firstYear} 到 ${s.lastYear}，一年光景。刚刚开始记录的你还带着些许生涩，但<em>认真的开始，本身就是一件很温柔的事。</em>`
  } else {
    title = '档案的序章'
    text = '这座档案馆里，静静躺着属于你的每一份记录。<em>愿你在这里，重新遇见从前的自己。</em>'
  }
  if (s.totalMessages < 5) {
    text += '<br>记录不多也没关系——<em>愿意收藏日子的人，一定很珍视生活。</em>'
  }
  return { id: 'cover', num: '§ 01', title, text, accent: `${s.nickname || '无名'} · ${s.firstYear || '——'}—${s.lastYear || '——'}` }
}

/** §02 总览 */
function describeOverview(s: AnnualStats): ReportChapter {
  const total = s.totalMessages
  let text: string
  if (total >= 1000) {
    text = `这座档案馆里，存放着 <em>${total.toLocaleString()}</em> 条说说。上千次表达，拼成了你与这个世界对话的样子。`
  } else if (total >= 100) {
    text = `这里有 <em>${total}</em> 条说说。百来个瞬间，足够说明你是一个爱记录、爱生活的人。`
  } else if (total > 0) {
    text = `这里静静躺着 <em>${total}</em> 条说说。数量不多，但每一条都曾是那一刻真实的你。`
  } else {
    text = '说说档案还空着——也许你更习惯把日子过在别处。没有记录也没关系，<em>生活本身就在替你记录。</em>'
  }
  return {
    id: 'overview',
    num: '§ 02',
    title: '这一年的文字',
    text,
    accent: `${total.toLocaleString()} 条`,
    data: { totals: { ...s } }
  }
}

/** §03 起点与终点（第一条 / 最近一条说说） */
function describeFirst(s: AnnualStats): ReportChapter {
  const f = s.firstMessage
  const l = s.lastMessage
  if (!f && !l) {
    return { id: 'first', num: '§ 03', title: '起点与终点', text: '还没有找到说说——<em>起点未至，故事待写。</em>' }
  }
  let text = ''
  let accent = ''
  if (f) {
    const d = parseTime(f.time)
    const dateStr = d ? `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日` : f.time
    const title = stripEm(f.title) || '（一条没有文字的说说）'
    text += `${dateStr}，你写下了第一条说说：「<em>${title}</em>」。<br>`
    accent = dateStr
  }
  if (l && l !== f) {
    const d = parseTime(l.time)
    const dateStr = d ? `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日` : l.time
    const title = stripEm(l.title) || '（一条没有文字的说说）'
    text += `而最近的一条，停在 ${dateStr}：「<em>${title}</em>」。<br>`
    accent = accent ? `${accent} → ${dateStr}` : dateStr
  }
  text += '<em>一头是开始，一头是现在——中间的每一天，都是你。</em>'
  return { id: 'first', num: '§ 03', title: '起点与终点', text, accent, data: { first: f, last: l } }
}

/** §04 年度活跃 */
function describeYears(s: AnnualStats): ReportChapter {
  const top = s.topYear
  if (!top) {
    return { id: 'years', num: '§ 04', title: '年度活跃', text: '还没有足够的数据描绘你的活跃轨迹。<em>别急，故事正在进行。</em>' }
  }
  const span = s.spanYears
  let text: string
  if (span >= 5 && top.count >= 500) {
    text = `${top.year} 年，是你最话痨的一年——写了 <em>${top.count.toLocaleString()}</em> 条说说。那一年，你一定有太多想说的话。`
  } else if (top.count >= 200) {
    text = `${top.year} 年是你表达欲最盛的一年，共 <em>${top.count.toLocaleString()}</em> 条。那年发生的许多事，如今都成了档案里沉甸甸的一页。`
  } else if (top.count >= 20) {
    text = `${top.year} 年，你写了 <em>${top.count}</em> 条说说。不算多，但足以看出，那一年你在认真地记录。`
  } else {
    text = `这些年来你偶有提笔，${top.year} 年的 ${top.count} 条记录，安静却真实。<em>记录不在多，贵在真挚。</em>`
  }
  return { id: 'years', num: '§ 04', title: '年度活跃', text, accent: `${top.year} · ${top.count} 条`, data: { yearCounts: s.yearCounts } }
}

/** §05 月度偏好 */
function describeMonths(s: AnnualStats): ReportChapter {
  const topMonth = s.topMonth
  if (topMonth == null) {
    return { id: 'months', num: '§ 05', title: '月度偏好', text: '数据尚在整理中，先让我们翻一翻旧历。' }
  }
  let text: string
  const count = s.monthCounts[topMonth - 1] || 0
  if (count >= 100) {
    text = `${cnNum(topMonth)}月，是你最想分享的季节——那个月你写下了 <em>${count}</em> 条说说。大概是春风、夏雨或秋意，总在撩拨你的表达欲。`
  } else if (count >= 10) {
    text = `${cnNum(topMonth)}月是你最活跃的月份，共 <em>${count}</em> 条。有些月份天生适合说话，而${cnNum(topMonth)}月，是你的主场。`
  } else {
    text = `你的分享随心而至，${cnNum(topMonth)}月偶尔冒头。<em>不挑日子记录的，都是好日子。</em>`
  }
  return { id: 'months', num: '§ 05', title: '月度偏好', text, accent: `${cnNum(topMonth)}月`, data: { monthCounts: s.monthCounts } }
}

/** §06 时辰（深夜/清晨） */
function describeNight(s: AnnualStats): ReportChapter {
  const hourCounts = s.hourCounts
  const total = hourCounts.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return { id: 'night', num: '§ 06', title: '时辰的偏爱', text: '还未积累足够的时间样本——<em>等你的故事再多一些，我们再来谈深夜与清晨。</em>' }
  }
  const night = s.nightRatio
  const dawn = s.dawnRatio
  const nightPct = Math.round(night * 100)
  const dawnPct = Math.round(dawn * 100)
  // 峰值时段
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
  const peakCount = hourCounts[peakHour] || 0
  const peakRatio = total ? peakCount / total : 0
  const peakLabel = peakHour < 6 ? `凌晨 ${peakHour} 点` : peakHour < 12 ? `上午 ${peakHour} 点` : peakHour < 18 ? `下午 ${peakHour} 点` : `晚上 ${peakHour} 点`
  let text: string
  if (night >= 0.5) {
    text = `<em>夜越深，你越清醒。</em>${nightPct}% 的说说诞生在深夜。白天属于世界，深夜才留给自己——那是你和自己说悄悄话的时间。`
  } else if (night >= 0.3) {
    text = `你的文字常在夜里悄悄生长，${nightPct}% 的说说写在深夜。<em>夜深人静时的心事，往往最真。</em>`
  } else if (dawn >= 0.3) {
    text = `你是被晨光叫醒的记录者——${dawnPct}% 的说说诞生在清晨。<em>第一缕光里，藏着你对新一天的期待。</em>`
  } else if (peakRatio >= 0.13 && peakCount >= 10) {
    text = `你的记录有一个悄悄偏爱的时间——${peakLabel}（${peakCount} 条）。<em>那些准点冒出的心情，大概是习惯，也是仪式。</em>`
  } else {
    text = `你的表达不挑时辰，白天黑夜都认真记录。<em>无论何时动笔，都是对生活的回应。</em>`
  }
  return {
    id: 'night',
    num: '§ 06',
    title: '时辰的偏爱',
    text,
    accent: `最爱 ${peakLabel}`,
    data: { hourCounts, nightRatio: night, dawnRatio: dawn, peakHour }
  }
}

/** §07 金句（最长的一条） */
function describeQuote(s: AnnualStats, d: AnnualDetail): ReportChapter {
  const longest = d.longestContent || (s.longestTitle ? { text: s.longestTitle.title, time: s.longestTitle.time } : null)
  if (!longest || !longest.text) {
    return { id: 'quote', num: '§ 07', title: '年度金句', text: '你似乎不善长文，更爱用只言片语表达。<em>短句有短句的浪漫。</em>' }
  }
  const len = longest.text.length
  const d2 = parseTime(longest.time)
  const dateStr = d2 ? `${d2.getFullYear()} 年 ${d2.getMonth() + 1} 月 ${d2.getDate()} 日` : ''
  let intro: string
  if (len >= 500) {
    intro = `那一天（${dateStr}），你写下整整 ${len} 个字的长文。${dateStr ? '那天的你，一定有太多想说的话。' : '大概是那天，你有太多话想对某个人、或对自己说。'}`
  } else if (len >= 100) {
    intro = `你最长的一段话，写在 ${dateStr}，共 ${len} 个字。`
  } else {
    intro = `你最长的一条说说，写在 ${dateStr}：`
  }
  const snippet = stripEm(longest.text).slice(0, 120)
  return {
    id: 'quote',
    num: '§ 07',
    title: '年度金句',
    text: `${intro}<br>「<em>${snippet}${stripEm(longest.text).length > 120 ? '…' : ''}</em>」`,
    accent: `${len} 字`,
    data: { longest }
  }
}

/** §08 互动高光 */
function describeHighlight(s: AnnualStats): ReportChapter {
  const like = s.topLike
  const comment = s.topComment
  const topLikes = like ? like.likeCount : 0
  const topComments = comment ? comment.commentCount : 0
  let text: string
  if (topLikes >= 100) {
    text = `你有一条被 <em>${topLikes}</em> 次喜欢的说说——原来你的日常，有这么多人一直在悄悄共鸣。<em>被喜欢的感觉，应该很暖吧。</em>`
  } else if (topLikes >= 10 && topComments >= 5) {
    text = `你最有话题的一条说说，收获了 <em>${topLikes} 次喜欢</em>、${topComments} 条评论。那些愿意停下来与你说话的人，都值得被记住。`
  } else if (topLikes >= 10) {
    text = `你收到过最多的一次是 <em>${topLikes} 次喜欢</em>。无需太多，被记住的瞬间本身就是礼物。`
  } else if (topComments > 0) {
    text = `虽然少有人按下喜欢，但有人愿意在你的说说下留言——最多的一条收到 <em>${topComments}</em> 条评论。<em>那些回应，是真实发生过的对话。</em>`
  } else if (topLikes > 0) {
    text = `你的说说曾被 <em>${topLikes}</em> 次喜欢。<em>每一次小小的回应，都是隔空的点头。</em>`
  } else {
    text = '你的说说几乎没有留下互动，但这并不妨碍它们的珍贵——<em>有些记录没有掌声，却忠实地替你把日子过了两遍。</em>'
  }
  const winner = topLikes >= topComments ? like : comment
  const winnerText = winner && winner.title ? `（「${stripEm(winner.title).slice(0, 30)}」）` : ''
  return {
    id: 'highlight',
    num: '§ 08',
    title: '互动高光',
    text,
    accent: `最多 ${Math.max(topLikes, topComments)}`,
    data: { topLike: like, topComment: comment, winnerText }
  }
}

/** §09 影像档案 */
function describeAlbum(s: AnnualStats): ReportChapter {
  const photos = s.totalPhotos
  const albums = s.topAlbums.length
  let text: string
  if (photos >= 1000) {
    text = `你用 <em>${photos.toLocaleString()}</em> 张照片，收进了生活里闪光的瞬间。${albums > 0 ? `其中「${s.topAlbums[0].name}」相册装了最多回忆。` : ''}<em>影像不会说话，却替你把日子记得清清楚楚。</em>`
  } else if (photos >= 100) {
    text = `<em>${photos}</em> 张照片，${albums} 个相册。按下快门的每一次，都是你不舍得忘记的一刻。`
  } else if (photos > 0) {
    text = `你有 <em>${photos}</em> 张照片收藏在这里。不多，但每一张都值得被好好对待。`
  } else {
    text = '影像档案暂时空白——也许你更习惯用文字记下日子。<em>形式不同，珍重相同。</em>'
  }
  return {
    id: 'album',
    num: '§ 09',
    title: '影像档案',
    text,
    accent: `${photos.toLocaleString()} 张`,
    data: { totalPhotos: photos, topAlbums: s.topAlbums }
  }
}

/** §10 人物志 */
function describePeople(s: AnnualStats, d: AnnualDetail): ReportChapter {
  const total = s.friendTotal
  const first = s.earliestFriend
  const intimacy = s.topIntimacyFriend
  const interactor = d.topInteractor
  const scopeLabel = s.year === 'all' ? '这些年来' : `${s.year} 年`
  if (total === 0 && !interactor) {
    return { id: 'people', num: '§ 10', title: '人物志', text: `${scopeLabel}，好友档案里没有新的记录——<em>没关系，真正的朋友不需要被数据证明。</em>` }
  }
  let intro: string
  if (s.year === 'all') {
    if (total >= 100) intro = `你的好友列表里有 <em>${total}</em> 位朋友。人来人往，留下的都是缘分。`
    else if (total >= 10) intro = `<em>${total}</em> 位好友，陪你走过或长或短的路。`
    else if (total > 0) intro = `有 <em>${total}</em> 位朋友在你的档案里。`
    else intro = '好友列表暂时空白，但在说说的互动里，我们记住了一些名字。'
  } else {
    if (total > 0) intro = `${scopeLabel}，你的好友列表里新加入了 <em>${total}</em> 位朋友。`
    else intro = `${scopeLabel} 没有新增好友，但在说说的互动里，我们记住了一些名字。`
  }

  const lines: { key: string; label: string; text: string; note: string; status: string }[] = []
  // 最早认识的好友（all = 全局最早；单年 = 该年最早加入）
  if (first) {
    const fname = (first.remark || first.name || '').trim() || `好友 ${first.uin}`
    const stillFriend = !(first.deleted === true || first.isFriend === false)
    const when = first.addFriendTime
      ? new Date(first.addFriendTime * 1000).toLocaleDateString('zh-CN')
      : ''
    lines.push({
      key: 'first',
      label: s.year === 'all' ? '最早认识' : '这一年最早认识',
      text: `「${fname}」`,
      note: when ? `（${when}）` : '',
      status: stillFriend ? '如今仍在你的好友列表里' : '如今已不在你的好友列表'
    })
  }
  // 互动最多：优先说说互动统计，回退亲密度
  if (interactor && interactor.count >= 2) {
    lines.push({
      key: 'talk',
      label: s.year === 'all' ? '常来聊天' : '这一年常来聊天',
      text: `「${interactor.name}」`,
      note: `在你的说说里出现过 ${interactor.count} 次`,
      status: ''
    })
  } else if (intimacy) {
    const iname = (intimacy.remark || intimacy.name || '').trim() || `好友 ${intimacy.uin}`
    lines.push({
      key: 'intimacy',
      label: '互动最多',
      text: `「${iname}」`,
      note: `亲密度 ${intimacy.intimacyScore}`,
      status: ''
    })
  }

  const text = intro + (lines.length
    ? '<br>' + lines.map(l => `· <em>${l.label}</em>：${l.text}${l.note}${l.status ? '，' + l.status : ''}`).join('<br>')
    : '')
  return { id: 'people', num: '§ 10', title: '人物志', text, accent: `${total} 位`, data: { total, lines } }
}

/** §11 特别的日子（按主题识别：生日 / 跨年 / 节日 / 大事） */
function describeSpecialDay(s: AnnualStats, d: AnnualDetail): ReportChapter {
  const days = d.specialDays
  if (!days.length) {
    return {
      id: 'special',
      num: '§ 11',
      title: '特别的日子',
      text: `${s.year === 'all' ? '这些年来' : s.year + ' 年'}，存档里没有发现特别的标注——也许你更习惯把那些日子过在心里。<em>没被记录的热闹，也值得被记得。</em>`
    }
  }
  const text = `${s.year === 'all' ? '这些年来' : s.year + ' 年'}，我们还帮你记下了这些特别的日子：<br>` +
    days.map(x => `· <em>${x.label}</em>：${x.text}`).join('<br>')
  return {
    id: 'special',
    num: '§ 11',
    title: '特别的日子',
    text,
    accent: `${days.length} 个`,
    data: { days }
  }
}

/** §12 年度词 */
function describeWord(d: AnnualDetail): ReportChapter {
  const words = d.words
  if (!words.length) {
    return { id: 'word', num: '§ 12', title: '年度词', text: '你的表达自由而散漫，不轻易被某个词概括。<em>这样也很好。</em>' }
  }
  const top = words[0]
  const list = words.slice(0, 5).map(w => w.word).join(' · ')
  return {
    id: 'word',
    num: '§ 12',
    title: '年度词',
    text: `这一年，「<em>${top.word}</em>」是你提起最多的字眼，出现了 ${top.count} 次。其他常伴你左右的还有：${list}。<em>原来这些，一直住在你的心里。</em>`,
    accent: top.word,
    data: { words }
  }
}

/** §13 结语 */
function describeConclusion(s: AnnualStats, d: AnnualDetail): ReportChapter {
  const total = s.totalMessages
  const night = s.nightRatio
  const likes = Math.max(s.topLike?.likeCount || 0, 0)
  let mid: string
  if (night >= 0.4) {
    mid = '夜里的你，说了很多温柔的话'
  } else if (total >= 500) {
    mid = '你一直勤勉地记录着生活'
  } else if (likes >= 20) {
    mid = '你的表达曾被许多人悄悄接住'
  } else {
    mid = '你安静而认真地过着自己的日子'
  }
  let text: string
  if (total >= 1000) {
    text = `${mid}。这一年的每一段文字、每一张照片，都被好好收进了这座档案馆。辛苦了，<em>愿来年，你的故事继续，档案继续增厚。</em>`
  } else if (total >= 100) {
    text = `${mid}。这一年辛苦了，你走过的路、说过的话、拍下的光，都有人（哪怕只是未来的你）替你保管。`
  } else if (total > 0) {
    text = `${mid}。记录不多，但字字珍贵。<em>愿今后的每一年，你都有值得写下的日子。</em>`
  } else {
    text = '档案虽空，生活却从未停笔。<em>愿你从今天起，把值得的瞬间，都存进这座档案馆。</em>'
  }
  return { id: 'conclusion', num: '§ 13', title: '结语', text, accent: `${d.words.length ? d.words[0].word : ''}` }
}

/* ==================== 聚合与主 composable ==================== */

function aggregateIndex(
  index: MessageIndex[],
  albumIndex: AlbumIndex[],
  friendIndex: FriendIndex[],
  year: number | 'all',
  nickname: string,
  uin: string
): AnnualStats {
  // 按年份过滤
  const filtered = year === 'all' ? index : index.filter(m => (m.time || '').startsWith(String(year)))

  // 排序（时间升序，取最早/最晚）
  const sorted = [...filtered].sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  // 年度统计
  const yearMap = new Map<number, number>()
  // 月度统计（1-12）
  const monthCounts = Array(12).fill(0)
  // 时段统计（0-23）
  const hourCounts = Array(24).fill(0)
  let totalMessages = 0

  for (const m of filtered) {
    const d = parseTime(m.time)
    if (!d) continue
    totalMessages++
    const y = d.getFullYear()
    yearMap.set(y, (yearMap.get(y) || 0) + 1)
    monthCounts[d.getMonth()]++
    hourCounts[d.getHours()]++
  }

  const yearCounts = Array.from(yearMap.entries())
    .map(([y, count]) => ({ year: y, count }))
    .sort((a, b) => a.year - b.year)

  const years = yearCounts.map(x => x.year)
  const firstYear = years.length ? years[0] : null
  const lastYear = years.length ? years[years.length - 1] : null
  const spanYears = firstYear && lastYear ? lastYear - firstYear + 1 : 0

  const topYear = yearCounts.length
    ? yearCounts.reduce((a, b) => (b.count > a.count ? b : a))
    : null

  const topMonth = (() => {
    let idx = -1
    let max = 0
    for (let i = 0; i < 12; i++) {
      if (monthCounts[i] > max) {
        max = monthCounts[i]
        idx = i
      }
    }
    return idx >= 0 ? idx + 1 : null
  })()

  // 深夜 22-5、清晨 6-9 占比
  const nightCount = hourCounts.slice(22).reduce((a, b) => a + b, 0) + hourCounts.slice(0, 6).reduce((a, b) => a + b, 0)
  const dawnCount = hourCounts.slice(6, 10).reduce((a, b) => a + b, 0)
  const nightRatio = totalMessages ? nightCount / totalMessages : 0
  const dawnRatio = totalMessages ? dawnCount / totalMessages : 0

  // 最长 title / 互动最高
  const byTitleLen = [...filtered].filter(m => m.title && m.title.trim()).sort((a, b) => b.title.length - a.title.length)
  const longestTitle = byTitleLen[0] || null
  const byComment = [...filtered].sort((a, b) => b.commentCount - a.commentCount)
  const byLike = [...filtered].sort((a, b) => b.likeCount - a.likeCount)
  const topComment = byComment[0] && byComment[0].commentCount > 0 ? byComment[0] : null
  const topLike = byLike[0] && byLike[0].likeCount > 0 ? byLike[0] : null

  // 影像
  const totalPhotos = albumIndex.reduce((sum, a) => sum + (a.photoCount || 0), 0)
  const topAlbums = [...albumIndex].sort((a, b) => (b.photoCount || 0) - (a.photoCount || 0)).slice(0, 3)
  const withTime = albumIndex.filter(a => a.createTimestamp)
  const earliestAlbum = withTime.length
    ? withTime.reduce((a, b) => (b.createTimestamp < a.createTimestamp ? b : a))
    : null

  // 好友（year 非 all 时仅统计该年新增的好友）
  const friendScope = year === 'all'
    ? friendIndex
    : friendIndex.filter(f => {
        if (!f.addFriendTime || f.addFriendTime <= 0) return false
        return new Date(f.addFriendTime * 1000).getFullYear() === year
      })
  const friendTotal = friendScope.length
  const friendWithTime = friendScope.filter(f => f.addFriendTime && f.addFriendTime > 0)
  const earliestFriend = friendWithTime.length
    ? friendWithTime.reduce((a, b) => (b.addFriendTime < a.addFriendTime ? b : a))
    : (friendScope[0] || null)
  const intimacyFriends = friendScope.filter(f => f.intimacyScore && f.intimacyScore > 0)
  const topIntimacyFriend = intimacyFriends.length
    ? intimacyFriends.reduce((a, b) => (b.intimacyScore > a.intimacyScore ? b : a))
    : null

  return {
    year,
    nickname,
    uin,
    totalMessages,
    spanYears,
    firstYear,
    lastYear,
    firstMessage: sorted[0] || null,
    lastMessage: sorted[sorted.length - 1] || null,
    yearCounts,
    topYear,
    monthCounts,
    topMonth,
    hourCounts,
    nightRatio,
    dawnRatio,
    longestTitle,
    topComment,
    topLike,
    totalPhotos,
    topAlbums,
    earliestAlbum,
    friendTotal,
    earliestFriend,
    topIntimacyFriend
  }
}

/**
 * 年度档案 composable
 * @param yearRef 年度（'all' 或具体年份），响应式支持切换
 */
export function useAnnualReport(yearRef: Ref<number | 'all'>) {
  const messagesStore = useMessagesStore()
  const userStore = useUserStore()
  const photosStore = usePhotosStore()
  const friendsStore = useFriendsStore()

  /** 索引级统计 */
  const stats = computed<AnnualStats>(() =>
    aggregateIndex(
      messagesStore.index,
      photosStore.index,
      friendsStore.index,
      yearRef.value,
      userStore.nickname,
      String(userStore.uin || '')
    )
  )

  /** 全量说说原文（按年缓存，loadDetail 后填充），供按年度重新聚合 */
  const rawItems = ref<RawMessage[]>([])
  const detailLoaded = ref(false)
  const detailLoading = ref(false)

  /**
   * 按当前年度聚合的内容（金句 / 年度词 / 互动 / 特别的日子）
   * 随 yearRef 变化即时重算
   */
  const detail = computed<AnnualDetail>(() => {
    const scope = yearRef.value === 'all'
      ? rawItems.value
      : rawItems.value.filter(r => r.year === yearRef.value)
    const contents = scope.map(r => r.text)

    // 金句：最长的一条
    let longest: { text: string; time: string; tid: string; year: number } | null = null
    for (const r of scope) {
      if (!longest || r.text.length > longest.text.length) {
        longest = { text: r.text, time: r.time, tid: r.tid, year: r.year }
      }
    }

    // 互动最多的人
    const interactorMap = new Map<string, { uin: string; name: string; count: number }>()
    for (const r of scope) {
      for (const p of r.interactors) {
        let rec = interactorMap.get(p.uin)
        if (!rec) {
          rec = { uin: p.uin, name: p.name, count: 0 }
          interactorMap.set(p.uin, rec)
        }
        rec.count++
      }
    }
    let topInteractor: { uin: string; name: string; count: number } | null = null
    interactorMap.forEach(rec => {
      if (!topInteractor || rec.count > topInteractor.count) topInteractor = rec
    })

    // 特别的日子：按主题识别，每类取最近一条
    const specialDays: SpecialDay[] = []
    for (const topic of SPECIAL_TOPICS) {
      let hit: RawMessage | null = null
      for (const r of scope) {
        if (topic.keywords.some(k => r.text.includes(k))) {
          if (!hit || r.time > hit.time) hit = r
        }
      }
      if (hit) {
        specialDays.push({
          key: topic.key,
          label: topic.label,
          mark: topic.mark,
          text: stripEm(hit.text).slice(0, 60),
          time: hit.time,
          tid: hit.tid,
          year: hit.year
        })
      }
    }

    return {
      contents,
      longestContent: longest,
      words: buildWordFreq(contents),
      topInteractor,
      specialDays
    }
  })

  /**
   * 按需加载全部说说全量数据（缓存原始文本，年份切换无需重复加载）
   * 建议视图层在用户滚动到内容类章节时调用，或挂载后延迟调用
   */
  async function loadDetail(): Promise<void> {
    if (detailLoaded.value || detailLoading.value) return
    detailLoading.value = true
    try {
      const years = messagesStore.yearGroups.map(([y]) => y)
      const items: RawMessage[] = []
      for (const y of years) {
        const list = await messagesStore.loadYear(y)
        const yearNum = parseInt(String(y), 10)
        for (const m of list) {
          const raw = (m as any).content || m.title || ''
          const text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          if (!text) continue
          // 该说说下的互动者（评论 / 点赞）
          const interactors: { uin: string; name: string }[] = []
          const lists = [(m as any).commentlist || [], (m as any).likes || []]
          for (const list2 of lists) {
            for (const p of list2) {
              const uin = p && (p.uin || p.uin64 || p.id)
              if (!uin) continue
              const k = String(uin)
              const name = (p.name || p.nickname || p.nick || '').trim() || k
              interactors.push({ uin: k, name })
            }
          }
          items.push({
            year: yearNum,
            tid: String((m as any).tid ?? ''),
            text,
            time: (m as any).custom_create_time || m.time || '',
            interactors
          })
        }
      }
      rawItems.value = items
      detailLoaded.value = true
    } finally {
      detailLoading.value = false
    }
  }

  /** 13 个章节文案 */
  const chapters = computed<ReportChapter[]>(() => {
    const s = stats.value
    const d = detail.value
    return [
      describeCover(s),
      describeOverview(s),
      describeFirst(s),
      describeYears(s),
      describeMonths(s),
      describeNight(s),
      describeQuote(s, d),
      describeHighlight(s),
      describeAlbum(s),
      describePeople(s, d),
      describeSpecialDay(s, d),
      describeWord(d),
      describeConclusion(s, d)
    ]
  })

  /** 首页用的第一条说说（无需年报） */
  const firstMessage = computed<MessageIndex | null>(() => {
    if (!messagesStore.index.length) return null
    return [...messagesStore.index].sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0]
  })

  return { stats, detail, detailLoaded, detailLoading, loadDetail, chapters, firstMessage }
}
