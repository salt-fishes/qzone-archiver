/**
 * 相册照片/视频的路径解析工具（相册列表卡片、相册详情网格共用）
 *
 * 相册条目既可能是图片也可能是视频，两者的本地文件字段语义不同：
 *   - 图片：原图在 custom_filepath
 *   - 视频：custom_filepath 指向 .mp4 文件（不能塞进 <img>），封面在 custom_pre_filepath
 * 不做区分直接把 custom_filepath 当缩略图时，视频封面会加载失败显示占位符
 * （表现为「相册列表里视频没有预览图，只有相册详细页才有」）。
 */
import { resolveModulePath } from '@/utils/formatContent'
import type { Photo } from '@/types'

const MODULE = 'Albums'

/** 是否为视频条目（相册视频：is_video 且带视频信息或已下载文件） */
export function isAlbumVideo(photo: Photo): boolean {
  return !!(photo.is_video && (photo.video_info || photo.custom_filepath))
}

/**
 * 条目缩略图 / 封面图可访问 URL：
 * - 视频条目：封面用本地 custom_pre_filepath，回退在线 custom_url
 * - 图片条目：本地原图 custom_filepath，回退 s_url / t_url / custom_url
 * 均不可用时返回空串
 */
export function albumPhotoThumb(photo: Photo): string {
  const raw = isAlbumVideo(photo)
    ? photo.custom_pre_filepath || photo.custom_url || ''
    : photo.custom_filepath || photo.s_url || photo.t_url || photo.custom_url || ''
  return raw ? resolveModulePath(raw, MODULE) : ''
}

/** 视频源：优先本地已下载 .mp4（custom_filepath），回退 video_info 在线地址 */
export function albumVideoSrc(photo: Photo): string {
  const info = photo.video_info || {}
  const local = photo.custom_filepath ? resolveModulePath(photo.custom_filepath, MODULE) : ''
  return local || info.video_url || info.play_url || ''
}
