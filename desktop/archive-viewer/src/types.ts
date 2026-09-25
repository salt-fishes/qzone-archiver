// SPA 端类型定义
// 数据结构对应扩展端 exportToSpa 生成的字段

export interface UserInfo {
  uin: number | string
  nickname?: string
  avatar?: string
  isOwner?: boolean
  messages?: number
  blogs?: number
  diaries?: number
  photos?: number
  videos?: number
  boards?: number
  favorites?: number
  shares?: number
  friends?: number
  visitors?: number
  [key: string]: any
}

/** 说说轻量索引项 —— 由 messages-index.js 提供 */
export interface MessageIndex {
  tid: string
  time: string
  title: string
  imgCount: number
  commentCount: number
  likeCount: number
  /** 列表缩略图地址数组（最多 4 张，相对 Messages/ 根或远程 URL） */
  thumbs?: string[]
}

/** 说说配图项 —— 来自 custom_images / pic 字段 */
export interface MediaImage {
  // 本地相对路径（相对模块根目录，如 'images/xxx.jpeg'）
  custom_filepath?: string
  // 原始远程 URL（备份后通常仍可用）
  custom_url?: string
  // 不同尺寸的 URL 备选
  url1?: string  // 原图
  url2?: string  // 备用
  url3?: string  // 缩略图
  b_url?: string  // 基础图
  s_url?: string  // 小图
  o_url?: string  // 原始
  hd_url?: string // 高清
  smallurl?: string
  // 尺寸信息
  height?: number
  width?: number
  b_height?: number
  b_width?: number
  hd_height?: number
  hd_width?: number
  pic_id?: string
  // 是否为视频（带 video_info）
  is_video?: boolean
  video_info?: MediaVideo
  [key: string]: any
}

/** 说说视频项 —— 来自 custom_videos 字段 */
export interface MediaVideo {
  custom_filepath?: string
  custom_url?: string
  url1?: string  // 封面
  url3?: string  // 视频地址
  pic_url?: string // 封面图
  video_id?: string
  video_time?: string
  cover_height?: number
  cover_width?: number
  [key: string]: any
}

/** 说说全量项 —— 由 messages-YYYY.js 提供 */
export interface Message {
  tid: string
  content?: string
  custom_content?: string
  custom_create_time?: string
  created_time?: number
  // 配图：扩展端转换后 custom_images 与 pic 等价
  pic?: MediaImage[]
  custom_images?: MediaImage[]
  // 兼容旧字段（实际数据中为空，仅用于类型完备）
  pic_list?: MediaImage[]
  // 视频
  video?: MediaVideo[]
  custom_videos?: MediaVideo[]
  // 语音、音乐
  voice?: any[]
  custom_voices?: any[]
  audio?: any[]
  custom_audios?: any[]
  // 趣味表情
  magic?: any[]
  custom_magics?: any[]
  // 评论与点赞
  commentlist?: Comment[]
  custom_comments?: Comment[]
  like?: { total?: number; list?: LikeItem[] }
  lbs?: { idname?: string; pos?: string; [key: string]: any }
  voicetotal?: number
  rt_tid?: string
  rt_con?: { content?: string; [key: string]: any }
  [key: string]: any
}

/**
 * 已删除说说 —— 由 messages-deleted.js 提供（实验性）
 * 通过好友互动消息列表恢复，结构与 Message 兼容，但部分字段可能缺失
 */
export interface DeletedMessage {
  tid: string
  isDeleted: true
  content?: string
  custom_content?: string
  custom_create_time?: string
  created_time?: number
  pic_list?: MediaImage[]
  custom_images?: MediaImage[]
  commentlist?: Comment[]
  custom_comments?: Comment[]
  commenttotal?: number
  like?: { total?: number; list?: LikeItem[] }
  likes?: LikeItem[]
  uniKey?: string
  [key: string]: any
}

export interface Comment {
  id?: string | number
  uin?: number | string
  name?: string
  nick?: string
  content?: string
  custom_create_time?: string
  create_time?: number
  /** 评论列表 API（commentlist_v6）返回的嵌套作者结构 */
  poster?: {
    id?: string | number
    uin?: string | number
    name?: string
    nick?: string
    nickname?: string
    [key: string]: any
  }
  /** 评论列表 API 返回的发布时间（unix 秒） */
  postTime?: number
  pic?: any[]
  list_3?: Comment[] // 二级回复
  [key: string]: any
}

export interface LikeItem {
  uin?: number | string
  nick?: string
  name?: string
  portrait?: string
  [key: string]: any
}

/** 访客轻量索引项 —— 由 visitors-index.js 提供 */
export interface VisitorIndex {
  uin: number | string
  name: string
  time: string
  /** 原始 unix 秒，用于与全量数据精确匹配 */
  ts: number
  src: number
  platformSrc: number
  isHideVisit: boolean
  yellow: number
  supervip: number
  uinsCount: number
  shuoshuoCount: number
  blogCount: number
  photoCount: number
  shareCount: number
}

/** 访客被访问的子内容（说说） */
export interface VisitorShuoshuo {
  id: string
  src: number
  platform_src: number
  service_src: number
  vtime: number
  url: string
  imgsrc?: string
  name: string
  custom_url?: string
  custom_filename?: string
  custom_filepath?: string
  [key: string]: any
}

/** 访客被访问的子内容（日志/相册/分享等） */
export interface VisitorSubItem {
  id?: string
  name: string
  imgsrc?: string
  custom_url?: string
  custom_filename?: string
  custom_filepath?: string
  [key: string]: any
}

/** 访客全量项 —— 由 visitors-YYYY.js 提供 */
export interface Visitor {
  uin: number | string
  src: number
  platform_src: number
  service_src: number
  time: number
  hide_from: number
  is_hide_visit: number
  name: string
  yellow: number
  supervip: number
  uins?: Visitor[]
  shuoshuoes?: VisitorShuoshuo[]
  blogs?: VisitorSubItem[]
  photoes?: VisitorSubItem[]
  shares?: VisitorSubItem[]
  [key: string]: any
}

// ============== Favorites 收藏模块 ==============

/**
 * 收藏类型枚举值（与扩展端 API.Favorites.getType 对齐）
 * 1=网页, 2=相片, 3=日志, 4=照片, 5=说说, 6=文字, 7=分享, 8=未知
 */
export type FavoriteType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** 收藏轻量索引项 —— 由 favorites-index.js 提供 */
export interface FavoriteIndex {
  /** 收藏唯一 ID，如 '2-3-{uin}_5_0ce8ce9c91d630695fb20400' */
  id: string
  /** 收藏原始类型值 */
  type: number
  /** 收藏类型中文标签：日志/说说/分享/照片/网页/文字/未知 */
  typeLabel: string
  /** 已格式化时间字符串 'YYYY-MM-DD HH:mm:ss' */
  time: string
  /** 源作者 uin（依据 type 从 blog_info/shuoshuo_info 等结构取值） */
  ownerUin: number | string
  /** 源作者昵称 */
  ownerName: string
  /** 标题（部分类型如日志/分享有，说说可能为空） */
  title: string
  /** 摘要文本 */
  abstract: string
  /** 配图数量 */
  imageCount: number
  /** 配图缩略图地址数组（最多 4 张，相对 Favorites/ 根或远程 URL） */
  thumbs?: string[]
  /** 原图数量 */
  originImageCount: number
  /** 视频数量 */
  videoCount: number
  /** 音频数量 */
  audioCount: number
}

/** 收藏中的视频信息（来自 custom_videos） */
export interface FavoriteVideo {
  url?: string
  preview_img?: string
  play_url?: string
  custom_pre_url?: string
  custom_pre_filename?: string
  custom_pre_filepath?: string
  custom_url?: string
  custom_filename?: string
  custom_filepath?: string
  [key: string]: any
}

/** 收藏中的音频信息（来自 custom_audios） */
export interface FavoriteAudio {
  url?: string
  preview_img?: string
  play_url?: string
  custom_url?: string
  custom_filename?: string
  custom_filepath?: string
  [key: string]: any
}

/** 收藏全量项 —— 由 favorites-YYYY.js 提供，保留扩展端原始结构 */
export interface Favorite {
  id: string
  type: number
  create_time: number
  title: string
  abstract: string
  desp: string
  platform: string
  user_agent: string
  /** 已格式化时间字符串 */
  custom_create_time: string
  custom_uin: number | string
  custom_name: string
  custom_abstract: string
  // 各类型的子结构
  shuoshuo_info?: {
    owner_uin?: number | string
    owner_name?: string
    reason?: string
    id?: string
    create_time?: number
    forward_flag?: number
    origin_uin?: number | string
    origin_name?: string
    video_list?: any[]
    detail_shuoshuo_info?: { content?: string; [k: string]: any }
    [key: string]: any
  }
  blog_info?: {
    owner_uin?: number | string
    owner_name?: string
    id?: string
    title?: string
    [key: string]: any
  }
  album_info?: {
    owner_uin?: number | string
    owner_name?: string
    id?: string
    name?: string
    [key: string]: any
  }
  share_info?: {
    owner_uin?: number | string
    owner_name?: string
    share_type?: number
    reason?: string
    share_url?: string
    blog_info?: any
    album_info?: any
    [key: string]: any
  }
  url_info?: {
    url?: string
    video_list?: any[]
    music_list?: any[]
    [key: string]: any
  }
  photo_list?: any[]
  // 媒体字段
  custom_images?: MediaImage[]
  custom_origin_images?: MediaImage[]
  custom_videos?: FavoriteVideo[]
  custom_audios?: FavoriteAudio[]
  [key: string]: any
}

// ========== Boards 留言 ==========

/** 留言轻量索引项 —— 由 boards-index.js 提供 */
export interface BoardIndex {
  uin: number | string
  nickname: string
  /** 已格式化时间字符串 'YYYY-MM-DD HH:mm:ss' */
  time: string
  /** 原始 unix 秒，用于排序与唯一性 */
  pubtime: number
  /** 是否私密留言 */
  secret: boolean
  /** 回复数量 */
  replyCount: number
  /** 摘要（HTML 去标签后截断 120 字） */
  abstract: string
}

/** 留言主人寄语 —— 由 boards-author.js 提供 */
export interface BoardAuthor {
  message?: string
  sign?: string
  [key: string]: any
}

/** 留言二级回复 */
export interface BoardReply {
  uin?: number | string
  name?: string
  content?: string
  /** unix 秒 */
  time?: number
  [key: string]: any
}

/** 留言全量项 —— 由 boards-YYYY.js 提供 */
export interface Board {
  uin: number | string
  /** 由扩展端 getOwner 计算得出 */
  nickname: string
  /** 已含本地图片路径的 HTML 内容 */
  htmlContent: string
  /** unix 秒 */
  pubtime: number
  secret: number
  replyList?: BoardReply[]
  [key: string]: any
}

// ========== Shares 分享 ==========

/** 分享类型枚举值（与扩展端 API.Shares.getDisplayType 对齐） */
export type ShareType = 1 | 2 | 3 | 4 | 5 | 10 | 13 | 17 | 18

/** 分享轻量索引项 —— 由 shares-index.js 提供 */
export interface ShareIndex {
  id: string
  uin: number | string
  nickname: string
  type: number
  typeLabel: string
  /** 已格式化时间字符串 'YYYY-MM-DD HH:mm:ss' */
  time: string
  /** 原始 unix 秒，用于排序 */
  shareTime: number
  /** 描述（HTML 去标签后截断 120 字） */
  desc: string
  sourceTitle: string
  sourceUrl: string
  sourceFromName: string
  sourceCount: number
  sourceImageCount: number
  /** 来源配图缩略图地址数组（最多 4 张，相对 Shares/ 根或远程 URL） */
  sourceThumbs?: string[]
  commentCount: number
  likeCount: number
  visitorCount: number
}

/** 分享源（来自 ShareSource） */
export interface ShareSource {
  title?: string
  desc?: string
  url?: string
  fromUrl?: string
  from?: { name?: string; url?: string; [k: string]: any }
  count?: number
  images?: MediaImage[]
  [key: string]: any
}

/** 分享评论（含二级回复） */
export interface ShareComment {
  poster?: { id?: number | string; name?: string; [k: string]: any }
  content?: string
  /** unix 秒 */
  postTime?: number
  pic?: MediaImage[]
  replies?: ShareReply[]
  [key: string]: any
}

export interface ShareReply {
  poster?: { id?: number | string; name?: string; [k: string]: any }
  content?: string
  postTime?: number
  pic?: MediaImage[]
  [key: string]: any
}

/** 分享访问者聚合 */
export interface ShareVisitor {
  viewCount?: number
  totalNum?: number
  list?: any[]
  [key: string]: any
}

/** 分享全量项 —— 由 shares-YYYY.js 提供 */
export interface Share {
  id: string
  uin: number | string
  nickname: string
  type: number
  desc: string
  /** unix 秒 */
  shareTime: number
  source: ShareSource
  comments?: ShareComment[]
  commentTotal?: number
  likes?: LikeItem[]
  likeTotal?: number
  uniKey?: string
  custom_visitor?: ShareVisitor
  [key: string]: any
}

// ========== Videos 视频 ==========

/**
 * 视频轻量索引项 —— 由 videos-index.js 提供
 * 扩展端 exportToSpa 生成的字段，用于首屏列表与年份归档
 */
export interface VideoIndex {
  /** 视频唯一 ID（vid 或 video_id） */
  vid: string
  /** 视频标题 */
  title: string
  /** 摘要文本（去 HTML 标签后截断 120 字） */
  desc: string
  /** 已格式化时间字符串 'YYYY-MM-DD HH:mm:ss' */
  time: string
  /** 上传时间 unix 秒，用于排序与按年分片 */
  uploadTime: number
  /** 评论数量 */
  commentCount: number
  /** 点赞数量 */
  likeCount: number
  /** 是否有本地视频文件（外部视频 play_url 非空时为 false） */
  hasLocalVideo: boolean
  /** 是否有封面图 */
  hasCover: boolean
  /** 封面图地址：本地路径（相对 Videos/ 根）或远程 URL，用于列表缩略图 */
  coverUrl?: string
  /** 本地视频文件路径（相对 Videos/ 根），用于列表黑封面修复 */
  videoSrc?: string
}

/**
 * 视频评论（结构与 ShareComment 类似，复用 Comment 也兼容）
 * 扩展端 videos.js 的 comments 字段结构
 */
export interface VideoComment {
  poster?: { id?: number | string; name?: string; [k: string]: any }
  content?: string
  /** unix 秒 */
  postTime?: number
  pic?: MediaImage[]
  replies?: VideoComment[]
  [key: string]: any
}

/**
 * 视频全量项 —— 由 videos-YYYY.js 提供
 * 保留扩展端原始结构，SPA 端按需加载后渲染详情
 */
export interface Video {
  vid: string
  video_id?: string
  shuoshuoid?: string
  title?: string
  desc?: string
  name?: string
  /** 上传时间 unix 秒 */
  uploadTime?: number
  uploadtime?: number
  /** 视频源 URL（本地 .mp4 或远程链接） */
  url?: string
  url1?: string
  url3?: string
  video_url?: string
  /** 外部视频播放页地址（非空表示外部视频，无本地文件） */
  play_url?: string
  /** 封面图 URL */
  pre?: string
  preview_img?: string
  /** 本地封面图相对路径（相对 Videos/ 模块根） */
  custom_pre_filepath?: string
  custom_pre_url?: string
  custom_pre_filename?: string
  /** 本地视频文件相对路径（相对 Videos/ 模块根） */
  custom_filepath?: string
  custom_url?: string
  custom_filename?: string
  /** 评论列表 */
  comments?: VideoComment[]
  cmtTotal?: number
  /** 点赞列表 */
  likes?: LikeItem[]
  like?: { total?: number; list?: LikeItem[] }
  /** 视频来源类型（外部平台标识） */
  source_type?: number
  uniKey?: string
  [key: string]: any
}

// ========== Friends 好友 ==========

/**
 * 好友轻量索引项 —— 由 friends-index.js 提供
 * 好友无自然的"发布时间"字段（addFriendTime 可能为 0），
 * 不适合按年份分片，改为按分组聚合的全量单文件。
 */
export interface FriendIndex {
  /** QQ 号 */
  uin: number | string
  /** 昵称（可能为空） */
  name: string
  /** 备注名 */
  remark: string
  /** 分组名 */
  groupName: string
  /** 分组 ID */
  groupId: number
  /** 添加好友时间 unix 秒（可能为 0） */
  addFriendTime: number
  /** 已格式化的添加时间字符串 */
  time: string
  /** 亲密度分数 */
  intimacyScore: number
  /** 是否特别关心 */
  care: boolean
  /** 是否仍为好友 */
  isFriend: boolean
  /** 是否已删除（曾经是好友但本次未拉到） */
  deleted: boolean
  /** 是否有头像 */
  hasAvatar: boolean
}

/**
 * 好友全量项 —— 由 friends-group.js 提供（按分组聚合）
 * 字段沿用扩展端原始结构
 */
export interface Friend {
  uin: number | string
  name?: string
  remark?: string
  groupName?: string
  groupid?: number
  addFriendTime?: number
  intimacyScore?: number
  care?: boolean
  isFriend?: boolean
  /** 本地头像相对路径 */
  custom_avatar_filepath?: string
  avatar?: string
  [key: string]: any
}

/** 好友分组聚合（friends-group.js 的数组元素） */
export interface FriendGroup {
  groupName: string
  count: number
  friends: Friend[]
}

// ========== Blogs 日志 ==========

/** 日志轻量索引项 —— 由 blogs-index.js 提供 */
export interface BlogIndex {
  blogId: string
  title: string
  category: string
  desc: string
  /** 已格式化时间字符串 */
  time: string
  /** 发布时间 unix 秒 */
  pubTime: number
  commentCount: number
  likeCount: number
  hasContent: boolean
  hasImages: boolean
}

/** 日志全量项 —— 由 blogs-YYYY.js 提供 */
export interface Blog {
  blogId?: string
  blogid?: string
  title?: string
  custom_title?: string
  category?: string
  effect?: string
  /** base64 编码的 HTML 正文 */
  html?: string
  custom_html?: string
  /** unix 秒 */
  pubTime?: number
  pubtime?: number
  /** 配图 */
  img?: MediaImage[]
  comments?: any[]
  replynum?: number
  likes?: LikeItem[]
  like?: { total?: number; list?: LikeItem[] }
  [key: string]: any
}

// ========== Diaries 日记 ==========

/** 日记轻量索引项 —— 由 diaries-index.js 提供 */
export interface DiaryIndex {
  blogId: string
  title: string
  category: string
  desc: string
  time: string
  pubTime: number
  commentCount: number
  likeCount: number
  hasContent: boolean
}

/** 日记全量项 —— 由 diaries-YYYY.js 提供 */
export interface Diary {
  blogid?: string
  blogId?: string
  title?: string
  custom_title?: string
  category?: string
  html?: string
  custom_html?: string
  pubTime?: number
  pubtime?: number
  comments?: any[]
  replynum?: number
  likes?: LikeItem[]
  like?: { total?: number; list?: LikeItem[] }
  [key: string]: any
}

// ========== Photos 相册 ==========

/**
 * 相册轻量索引项 —— 由 photos-index.js 提供
 * 不含 photoList，避免索引过大
 */
export interface AlbumIndex {
  albumId: string
  name: string
  desc: string
  /** 分类名（如"最爱"/"人物"/"生活"） */
  className: string
  classid: number
  /** 已格式化创建时间 */
  createTime: string
  createTimestamp: number
  modifyTime: string
  modifyTimestamp: number
  photoCount: number
  commentCount: number
  likeCount: number
  hasCover: boolean
  /** 封面图相对路径（相对 Albums/ 模块根） */
  coverUrl: string
}

/** 单张相片项 —— 来自 photoList */
export interface Photo {
  /** 本地图片相对路径（相对 Albums/ 模块根） */
  custom_filepath?: string
  custom_url?: string
  s_url?: string
  t_url?: string
  b_url?: string
  prevfilepath?: string
  pic_id?: string
  name?: string
  desc?: string
  height?: number
  width?: number
  [key: string]: any
}

/**
 * 相册全量项 —— 由 photos-album-<id>.js 提供
 * 包含 photoList
 */
export interface Album {
  id?: string
  albumId?: string
  name?: string
  desc?: string
  className?: string
  classid?: number
  createtime?: number
  modifytime?: number
  total?: number
  photoList?: Photo[]
  comments?: any[]
  likes?: LikeItem[]
  like?: { total?: number; list?: LikeItem[] }
  custom_filepath?: string
  custom_pre_filepath?: string
  [key: string]: any
}
