/**
 * 视频编码兼容性检测与播放失败文案
 *
 * H.265（HEVC）编码视频在多数 Chrome 环境无法直接解码（软解不支持，
 * 硬解依赖系统解码器）。为保持扩展轻量，未内置 HEVC 解码能力，因此
 * 播放失败时给出引导：建议发送到微信 / QQ 或使用 VLC 等主流播放软件打开。
 */

/** 检测当前浏览器是否支持 H.265 / HEVC 解码 */
export function detectHevcSupport(): boolean {
  try {
    const v = document.createElement('video')
    return !!(
      v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') ||
      v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"')
    )
  } catch {
    return false
  }
}

/**
 * 根据 video 的 error 状态判断是否属于「编码不支持」类失败
 * （SRC_NOT_SUPPORTED = 4 / DECODE = 3）
 */
export function isCodecUnsupportedError(video: HTMLVideoElement | null): boolean {
  const code = video?.error?.code
  return code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE
}

/**
 * H.265 播放失败的引导文案（供提示卡展示）
 */
export const HEVC_UNSUPPORTED_MESSAGE =
  '该视频为 H.265（HEVC）编码。为保持扩展轻量化，暂未内置 H.265 解码能力，当前浏览器无法直接播放。你可以将视频发送到微信 / QQ，或用 VLC 播放器等主流播放软件打开。'

/**
 * 通用播放失败文案（文件缺失 / 损坏等）
 */
export const VIDEO_PLAY_ERROR_MESSAGE =
  '视频文件无法打开，可能文件缺失或已损坏，请确认视频文件是否完整。'
