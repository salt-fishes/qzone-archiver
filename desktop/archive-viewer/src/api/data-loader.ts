import type { UserInfo, MessageIndex, Message, DeletedMessage, VisitorIndex, Visitor, FavoriteIndex, Favorite, BoardIndex, Board, BoardAuthor, ShareIndex, Share, VideoIndex, Video, FriendIndex, FriendGroup, BlogIndex, Blog, DiaryIndex, Diary, AlbumIndex, Album } from '@/types'

// 已加载脚本的 src 集合，避免重复注入
const loadedScripts = new Set<string>()

/**
 * 数据文件根路径解析
 *
 * 开发模式 (vite dev server)：
 *   - public/ 下有 Common/ 和 Messages/ 目录
 *   - dev server 把 public/ 映射到根 /
 *   - 路径如 /Common/json/user.js, /Messages/data/messages-index.js
 *
 * 生产模式 (file:// 直开 SPA)：
 *   - SPA 部署在 备份根/Common/spa/index.html
 *   - 备份根有 Common/ 和 Messages/ 两个兄弟目录
 *   - 从 Common/spa/ 出发：
 *     - 到 Common/json/ 需回退 1 级：../json/
 *     - 到 Messages/data/ 需回退 2 级：../../Messages/data/
 */
const DEV = import.meta.env.DEV
const COMMON_BASE = DEV ? '/Common/' : '../'
const MESSAGES_BASE = DEV ? '/Messages/' : '../../Messages/'
const VISITORS_BASE = DEV ? '/Visitors/' : '../../Visitors/'
const FAVORITES_BASE = DEV ? '/Favorites/' : '../../Favorites/'
const BOARDS_BASE = DEV ? '/Boards/' : '../../Boards/'
const SHARES_BASE = DEV ? '/Shares/' : '../../Shares/'
const VIDEOS_BASE = DEV ? '/Videos/' : '../../Videos/'
const FRIENDS_BASE = DEV ? '/Friends/' : '../../Friends/'
const BLOGS_BASE = DEV ? '/Blogs/' : '../../Blogs/'
const DIARIES_BASE = DEV ? '/Diaries/' : '../../Diaries/'
// 注意：相册数据实际存放目录名为 Albums（沿用扩展端命名）
const PHOTOS_BASE = DEV ? '/Albums/' : '../../Albums/'

/**
 * 通过动态 <script> 标签加载 JS 数据文件
 * 避开 file:// 协议下 fetch 的 CORS 限制
 * 数据文件格式由扩展端 writeJsonToJs 生成：window.<varName> = {...}
 *
 * @param src 相对路径或绝对路径
 * @param varName 数据挂在 window 上的变量名
 */
export function loadScript<T>(src: string, varName?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const target = (window as any)[varName || '']
    if (loadedScripts.has(src) && target !== undefined) {
      resolve(target as T)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      loadedScripts.add(src)
      const data = (window as any)[varName || '']
      if (data === undefined) {
        reject(new Error(`数据文件加载成功但变量未定义: ${src} / window.${varName}`))
        return
      }
      resolve(data as T)
    }
    script.onerror = () => reject(new Error(`数据文件加载失败: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * 加载用户信息（位于 Common/json/user.js）
 */
export async function loadUserInfo(): Promise<UserInfo> {
  return loadScript<UserInfo>(`${COMMON_BASE}json/user.js`, 'userInfo')
}

/**
 * 加载说说索引（位于 Messages/data/messages-index.js，~50KB）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadMessagesIndex(): Promise<MessageIndex[]> {
  return loadScript<MessageIndex[]>(`${MESSAGES_BASE}data/messages-index.js`, 'messagesIndex')
}

/**
 * 按需加载某年的全量说说数据
 * 数据文件命名约定：messages-YYYY.js，挂载为 window.messages_YYYY
 */
export async function loadMessagesByYear(year: number | string): Promise<Message[]> {
  return loadScript<Message[]>(
    `${MESSAGES_BASE}data/messages-${year}.js`,
    `messages_${year}`
  )
}

/**
 * 加载已删除说说（实验性）
 * 数据文件位于 Messages/data/messages-deleted.js，挂载为 window.messagesDeleted
 * 文件可能不存在（未开启恢复功能时），调用方需捕获异常
 */
export async function loadMessagesDeleted(): Promise<DeletedMessage[]> {
  return loadScript<DeletedMessage[]>(`${MESSAGES_BASE}data/messages-deleted.js`, 'messagesDeleted')
}

/**
 * 加载访客索引（位于 Visitors/data/visitors-index.js）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadVisitorsIndex(): Promise<VisitorIndex[]> {
  return loadScript<VisitorIndex[]>(`${VISITORS_BASE}data/visitors-index.js`, 'visitorsIndex')
}

/**
 * 按需加载某年的全量访客数据
 * 数据文件命名约定：visitors-YYYY.js，挂载为 window.visitors_YYYY
 */
export async function loadVisitorsByYear(year: number | string): Promise<Visitor[]> {
  return loadScript<Visitor[]>(
    `${VISITORS_BASE}data/visitors-${year}.js`,
    `visitors_${year}`
  )
}

/**
 * 加载收藏索引（位于 Favorites/data/favorites-index.js）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadFavoritesIndex(): Promise<FavoriteIndex[]> {
  return loadScript<FavoriteIndex[]>(`${FAVORITES_BASE}data/favorites-index.js`, 'favoritesIndex')
}

/**
 * 按需加载某年的全量收藏数据
 * 数据文件命名约定：favorites-YYYY.js，挂载为 window.favorites_YYYY
 */
export async function loadFavoritesByYear(year: number | string): Promise<Favorite[]> {
  return loadScript<Favorite[]>(
    `${FAVORITES_BASE}data/favorites-${year}.js`,
    `favorites_${year}`
  )
}

/**
 * 加载留言索引（位于 Boards/data/boards-index.js）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadBoardsIndex(): Promise<BoardIndex[]> {
  return loadScript<BoardIndex[]>(`${BOARDS_BASE}data/boards-index.js`, 'boardsIndex')
}

/**
 * 加载留言主人寄语（位于 Boards/data/boards-author.js）
 */
export async function loadBoardsAuthor(): Promise<BoardAuthor> {
  return loadScript<BoardAuthor>(`${BOARDS_BASE}data/boards-author.js`, 'boardsAuthor')
}

/**
 * 按需加载某年的全量留言数据
 * 数据文件命名约定：boards-YYYY.js，挂载为 window.boards_YYYY
 */
export async function loadBoardsByYear(year: number | string): Promise<Board[]> {
  return loadScript<Board[]>(
    `${BOARDS_BASE}data/boards-${year}.js`,
    `boards_${year}`
  )
}

/**
 * 加载分享索引（位于 Shares/data/shares-index.js）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadSharesIndex(): Promise<ShareIndex[]> {
  return loadScript<ShareIndex[]>(`${SHARES_BASE}data/shares-index.js`, 'sharesIndex')
}

/**
 * 按需加载某年的全量分享数据
 * 数据文件命名约定：shares-YYYY.js，挂载为 window.shares_YYYY
 */
export async function loadSharesByYear(year: number | string): Promise<Share[]> {
  return loadScript<Share[]>(
    `${SHARES_BASE}data/shares-${year}.js`,
    `shares_${year}`
  )
}

/**
 * 加载视频索引（位于 Videos/data/videos-index.js）
 * SPA 启动时立即调用，用于侧边栏目录与搜索
 */
export async function loadVideosIndex(): Promise<VideoIndex[]> {
  return loadScript<VideoIndex[]>(`${VIDEOS_BASE}data/videos-index.js`, 'videosIndex')
}

/**
 * 按需加载某年的全量视频数据
 * 数据文件命名约定：videos-YYYY.js，挂载为 window.videos_YYYY
 */
export async function loadVideosByYear(year: number | string): Promise<Video[]> {
  return loadScript<Video[]>(
    `${VIDEOS_BASE}data/videos-${year}.js`,
    `videos_${year}`
  )
}

// ========== Friends 好友 ==========

/**
 * 加载好友索引（位于 Friends/data/friends-index.js）
 * 好友不按年份分片，索引即全量列表（轻量字段）
 */
export async function loadFriendsIndex(): Promise<FriendIndex[]> {
  return loadScript<FriendIndex[]>(`${FRIENDS_BASE}data/friends-index.js`, 'friendsIndex')
}

/**
 * 加载好友分组全量数据（位于 Friends/data/friends-group.js）
 * 包含每个分组的完整好友列表，单文件（好友总量通常不大）
 */
export async function loadFriendsGroup(): Promise<FriendGroup[]> {
  return loadScript<FriendGroup[]>(`${FRIENDS_BASE}data/friends-group.js`, 'friendsGroup')
}

// ========== Blogs 日志 ==========

/**
 * 加载日志索引（位于 Blogs/data/blogs-index.js）
 */
export async function loadBlogsIndex(): Promise<BlogIndex[]> {
  return loadScript<BlogIndex[]>(`${BLOGS_BASE}data/blogs-index.js`, 'blogsIndex')
}

/**
 * 按需加载某年的全量日志数据
 * 数据文件命名约定：blogs-YYYY.js，挂载为 window.blogs_YYYY
 */
export async function loadBlogsByYear(year: number | string): Promise<Blog[]> {
  return loadScript<Blog[]>(
    `${BLOGS_BASE}data/blogs-${year}.js`,
    `blogs_${year}`
  )
}

// ========== Diaries 日记 ==========

/**
 * 加载日记索引（位于 Diaries/data/diaries-index.js）
 */
export async function loadDiariesIndex(): Promise<DiaryIndex[]> {
  return loadScript<DiaryIndex[]>(`${DIARIES_BASE}data/diaries-index.js`, 'diariesIndex')
}

/**
 * 按需加载某年的全量日记数据
 * 数据文件命名约定：diaries-YYYY.js，挂载为 window.diaries_YYYY
 */
export async function loadDiariesByYear(year: number | string): Promise<Diary[]> {
  return loadScript<Diary[]>(
    `${DIARIES_BASE}data/diaries-${year}.js`,
    `diaries_${year}`
  )
}

// ========== Photos 相册 ==========

/**
 * 加载相册索引（位于 Albums/data/photos-index.js）
 * 仅含相册元信息，不含 photoList
 */
export async function loadPhotosIndex(): Promise<AlbumIndex[]> {
  return loadScript<AlbumIndex[]>(`${PHOTOS_BASE}data/photos-index.js`, 'photosIndex')
}

/**
 * 按需加载单个相册的全量数据（含 photoList）
 * 数据文件命名约定：photos-album-<id>.js，挂载为 window.photos_album_<id>
 * 注意变量名中的 albumId 可能包含特殊字符，需替换为下划线
 */
export async function loadAlbumById(albumId: string): Promise<Album> {
  // albumId 可能含特殊字符（如 V50PvfYN3AbxHj1EUt8m3DRKFv0iRFBq），直接用作变量名
  // JS 标识符规则下，window['photos_album_<id>'] 方式访问更安全
  const varName = `photos_album_${albumId}`
  return loadScript<Album>(`${PHOTOS_BASE}data/photos-album-${albumId}.js`, varName)
}
