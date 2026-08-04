/**
 * SPA 内容格式化工具
 *
 * 处理 QQ 空间说说/评论正文中常见的特殊标记：
 *   1. @{uin:XXX,nick:YYY,who:Z,auto:N}  → @YYY（带链接）
 *      还要兼容无前导 @ 的简写：{uin:XXX,nick:YYY,who:Z,auto:N}
 *      以及 nick 中可能含特殊字符（如英文括号）的情况
 *   2. [em]eXXX[/em]                      → 本地表情图片 <img src="...images/eXXX.gif">
 *
 * 表情图与模块图片均已下载到 备份根 下各模块的 images/ 目录。
 * SPA 部署在 备份根/Common/spa/index.html，因此路径需回退两级：
 *   - Common/images/eXXX.gif  → ../images/eXXX.gif
 *   - Messages/images/xx.jpeg → ../../Messages/images/xx.jpeg
 *
 * 数据来自扩展端 exportToSpa，原始字段 custom_filepath 形如 'images/xxx.jpeg'
 * （相对模块根目录），需要拼装为 SPA 可访问的相对 URL。
 */

/** 开发模式（vite dev server）下 public/ 映射到根 /，生产模式 file:// 下需回退路径 */
const DEV = import.meta.env.DEV

/** 表情图所在目录（Common/images/）相对 SPA 根的路径 */
const EMOTION_BASE = DEV ? '/Common/images/' : '../images/'

/**
 * 各模块根目录相对 SPA 根的路径映射
 * SPA 位于 备份根/Common/spa/，需要回退两级才能进入模块目录
 */
const MODULE_BASE: Record<string, string> = {
  Messages: DEV ? '/Messages/' : '../../Messages/',
  Blogs: DEV ? '/Blogs/' : '../../Blogs/',
  Diaries: DEV ? '/Diaries/' : '../../Diaries/',
  Albums: DEV ? '/Albums/' : '../../Albums/',
  Videos: DEV ? '/Videos/' : '../../Videos/',
  Boards: DEV ? '/Boards/' : '../../Boards/',
  Favorites: DEV ? '/Favorites/' : '../../Favorites/',
  Shares: DEV ? '/Shares/' : '../../Shares/',
  Friends: DEV ? '/Friends/' : '../../Friends/',
  Visitors: DEV ? '/Visitors/' : '../../Visitors/'
}

/**
 * 将模块内的相对路径（如 'images/xxx.jpeg'）转换为 SPA 可访问的 URL
 * @param filepath 模块内相对路径
 * @param module 所属模块名
 *
 * 注意：扩展端导出的图片文件普遍没有后缀名（哈希文件名，如 'images/6E4FC5AA'），
 * 浏览器能通过文件头自动识别图片格式，无需补充后缀。
 * 千万不要主动补 .jpg —— 磁盘上的文件就是无后缀的，补后缀反而会导致 404。
 */
export function resolveModulePath(filepath: string, module = 'Messages'): string {
  if (!filepath) return ''
  // 已经是绝对 URL（http(s):// 或 //）直接返回
  if (/^https?:\/\//i.test(filepath) || filepath.startsWith('//')) return filepath
  // 已经是 data: URL
  if (filepath.startsWith('data:')) return filepath
  const base = MODULE_BASE[module] || MODULE_BASE.Messages
  // 去掉开头的 ./ 或 /
  const clean = filepath.replace(/^\.?\//, '')
  // custom_filepath 可能已含模块前缀（如 "Albums/生活/xxx.jpeg"），
  // 此时 base（如 "../../Albums/"）已含模块名，直接拼接会重复。
  // 检测并去除 filepath 中的模块前缀，避免路径重复。
  const modulePrefix = module + '/'
  if (clean.toLowerCase().startsWith(modulePrefix.toLowerCase())) {
    return base + clean.substring(modulePrefix.length)
  }
  return base + clean
}

/** 转义 HTML 特殊字符，避免内容破坏模板结构 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 根据 QQ 号生成 qlogo 头像在线地址
 * 与扩展端 API.Common.getUserLogoUrl 同规则：
 *   https://qlogo{1-4}.store.qq.com/qzone/{uin}/{uin}/100
 */
export function buildQzoneAvatarUrl(uin: number | string): string {
  if (uin === undefined || uin === null || uin === '') return ''
  const n = Number(uin)
  const host = Number.isFinite(n) && n > 0 ? (n % 4 || 1) : 1
  return `https://qlogo${host}.store.qq.com/qzone/${uin}/${uin}/100`
}

/**
 * 备份根 Common/images/ 下共享文件的 SPA 相对路径
 * 扩展端 custom_avatar 形如 'Common/images/66600000'（相对备份根），
 * SPA 部署在 备份根/Common/spa/，生产模式需回退一级 → ../images/xxx
 */
export function resolveCommonImagePath(filepath: string): string {
  if (!filepath) return ''
  if (/^https?:\/\//i.test(filepath) || filepath.startsWith('//') || filepath.startsWith('data:')) return filepath
  const clean = filepath.replace(/^\.?\//, '').replace(/^Common\//, '')
  return (DEV ? '/Common/' : '../') + clean
}

/**
 * 处理 @ 提及标记：
 *   @{uin:XXX,nick:YYY,who:Z,auto:N} → @YYY
 *   也兼容无 @ 前导的 {uin:XXX,nick:YYY,who:Z,auto:N}
 *
 * @param text 待处理文本
 * @param plain true 时输出纯文本 <span>（二级评论用），false 输出 <a> 链接（一级评论/说说正文用）
 */
function formatMentions(text: string, plain: boolean = false): string {
  const buildReplacement = (uin: string, nick: string) => {
    const safeNick = escapeHtml(nick || uin)
    if (plain) {
      return `<span class="mention-text">@${safeNick}</span>`
    }
    return `<a class="mention" href="https://user.qzone.qq.com/${uin}" target="_blank" rel="noopener">@${safeNick}</a>`
  }
  // 先处理带 @ 前缀的标准格式
  let result = text.replace(
    /@\{uin:([^,}]+),\s*nick:([^,}]*?)(?:,\s*who:[^,}]*)?(?:,\s*auto:[^,}]*)?\}/g,
    (_m, uin: string, nick: string) => buildReplacement(uin, nick)
  )
  // 处理无 @ 前导的简写形式（仅当仍含 uin/nick/who 三者时）
  if (result.includes('uin') && result.includes('nick') && result.includes('who')) {
    result = result.replace(
      /\{uin:([^,}]+),\s*nick:([^,}]*?)(?:,\s*who:[^,}]*)?(?:,\s*auto:[^,}]*)?\}/g,
      (_m, uin: string, nick: string) => buildReplacement(uin, nick)
    )
  }
  return result
}

/**
 * 处理 [em]eXXX[/em] 表情代码 → 本地 <img>
 */
function formatEmoticons(text: string): string {
  return text.replace(
    /\[em\]e(\d+)\[\/em\]/gi,
    (_m, eid: string) => {
      const src = `${EMOTION_BASE}e${eid}.gif`
      return `<img class="emoticon" src="${src}" alt="[em]e${eid}[/em]" loading="lazy" />`
    }
  )
}

/** formatContent 选项 */
export interface FormatOptions {
  /**
   * @ 提及输出为纯文本而非跳转链接
   * 二级评论的 @ 通常只是回复指示，不需要跳转到用户主页
   */
  plainMentions?: boolean
}

/**
 * 完整格式化内容：先转义，再依次处理 @ 提及和 [em] 表情
 *
 * 注意：调用方应使用 v-html 渲染返回值（内容已转义，可安全注入）
 */
export function formatContent(content: string, options: FormatOptions = {}): string {
  if (!content) return ''
  // 1. 先转义 HTML，防止用户内容破坏模板
  let result = escapeHtml(content)
  // 2. 处理 @ 提及（注意：转义后双引号已变 &quot;，不影响正则匹配）
  result = formatMentions(result, options.plainMentions === true)
  // 3. 处理 [em] 表情代码
  result = formatEmoticons(result)
  return result
}

/**
 * 列表卡片用的纯文本预览：把 [em]eXXX[/em] 表情代码替换为「[表情]」占位，
 * @ 提及标记提取为 @昵称，去掉所有花括号包裹的元数据。
 *
 * 用于 MessageCard 等轻量列表项，避免在每条卡片上都加载一堆表情图。
 */
export function stripFormatting(content: string): string {
  if (!content) return ''
  let result = content
  // [em]eXXX[/em] → [表情]
  result = result.replace(/\[em\]e\d+\[\/em\]/gi, '[表情]')
  // @{uin:XXX,nick:YYY,...} → @YYY
  result = result.replace(
    /@\{uin:[^,}]+,\s*nick:([^,}]*?)(?:,.*?)?\}/g,
    (_m, nick: string) => `@${nick || '匿名'}`
  )
  // 无 @ 前导的简写 {uin:XXX,nick:YYY,...} → @YYY
  result = result.replace(
    /\{uin:[^,}]+,\s*nick:([^,}]*?)(?:,.*?)?\}/g,
    (_m, nick: string) => `@${nick || '匿名'}`
  )
  return result.trim()
}

/**
 * 格式化 Unix 时间戳（秒）为 'YYYY-MM-DD HH:mm:ss' 字符串
 * 对齐扩展端 API.Utils.formatDate(time) 的默认输出格式，用于访客等模块的时间展示与索引匹配。
 *
 * 注意：扩展端使用本地时区（new Date(time*1000).format('yyyy-MM-dd hh:mm:ss')），
 * 这里同样使用本地时区以保持一致。
 */
export function formatUnixTime(time: number): string {
  if (!time || !Number.isFinite(time)) return ''
  const d = new Date(time * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}
