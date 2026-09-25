// 年代分段工具（§4.1 分段头）：YYYY → 「二〇二四年」汉字卷记
const DIGITS: Record<string, string> = {
  '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
}

/** '2024' → '二〇二四年'；非 4 位年份原样返回 */
export function yearLabel(year: string): string {
  if (!/^\d{4}$/.test(year)) return year
  const cn = [...year].map(d => DIGITS[d] ?? d).join('')
  return `${cn}年`
}
