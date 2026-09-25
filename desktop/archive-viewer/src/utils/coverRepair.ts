/**
 * 视频黑封面修复工具
 *
 * 现象：QQ 空间部分视频（早期 QQ视频 / 手机录像）导出的封面 JPEG 本身是纯黑帧，
 * 备份中缩略图显示为全黑。本工具在封面加载完成后做像素采样检测，
 * 若判定为纯黑，则用本地已下载的 mp4 提取首帧（seek 到 0.1s 跳过黑首帧）生成 dataURL 替换。
 * 供所有显示视频封面的组件复用（相册详情、媒体网格等）。
 */

/** 黑帧判定阈值：采样像素 RGB 均低于该值视为黑帧 */
const BLACK_THRESHOLD = 10
/** 封面替换缓存：封面 src → 首帧 dataURL（模块级，会话内复用，避免重复提取） */
const coverFrameCache = new Map<string, string>()

/**
 * 采样检测图片是否为纯黑帧（缩到 24x24 后统计亮度）
 */
export function isBlackImage(img: HTMLImageElement): boolean {
  const size = 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  try {
    ctx.drawImage(img, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size).data
    let black = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      if (data[i] < BLACK_THRESHOLD && data[i + 1] < BLACK_THRESHOLD && data[i + 2] < BLACK_THRESHOLD) black++
    }
    const total = data.length / 4
    return total > 0 && black / total > 0.98
  } catch {
    // 跨域 / 不可读图像按非黑处理
    return false
  }
}

/**
 * 从本地 mp4 提取一帧封面（跳到 0.1s 跳过可能黑的首帧）
 * @returns JPEG dataURL，失败返回 null
 */
export function extractVideoFrame(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    let settled = false
    const finish = (dataUrl: string | null) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      try { video.load() } catch { /* 忽略 */ }
      resolve(dataUrl)
    }
    video.onerror = () => finish(null)
    video.onloadedmetadata = () => {
      try {
        video.currentTime = 0.1
      } catch {
        finish(null)
      }
    }
    video.onseeked = () => {
      try {
        // 限制封面最大宽度，避免 dataURL 过大
        const maxW = 480
        let w = video.videoWidth || 640
        let h = video.videoHeight || 360
        if (w > maxW) {
          h = Math.round((h * maxW) / w)
          w = maxW
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(null)
        ctx.drawImage(video, 0, 0, w, h)
        finish(canvas.toDataURL('image/jpeg', 0.75))
      } catch {
        finish(null)
      }
    }
    video.src = src
    // 超时保护：8s 内未完成则放弃（保持原封面）
    setTimeout(() => finish(null), 8000)
  })
}

/**
 * 封面修复入口：视频封面为黑帧时用本地视频首帧替换
 * @param img 已加载完成的封面 <img> 元素
 * @param videoSrc 视频源（优先本地已下载 mp4）
 * @returns 替换后的 JPEG dataURL；非黑帧 / 无需处理 / 提取失败返回 null
 */
export async function repairBlackCover(img: HTMLImageElement, videoSrc: string): Promise<string | null> {
  if (!videoSrc) return null
  // 已提取过的封面直接复用缓存
  const cacheKey = img.src || videoSrc
  const cached = coverFrameCache.get(cacheKey)
  if (cached) return cached
  // 非黑帧封面不处理
  if (!isBlackImage(img)) return null
  // 提取本地视频首帧替换
  const frame = await extractVideoFrame(videoSrc)
  if (frame) {
    coverFrameCache.set(cacheKey, frame)
  }
  return frame
}
