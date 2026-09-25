// 全文搜索 hook —— 基于 FlexSearch Document 索引
// 用于说说索引列表的关键字筛选（标题 + 时间）
import { ref, watch, type Ref } from 'vue'
import type { MessageIndex } from '@/types'

// 动态加载 flexsearch 模块，避免静态 import 在 ESM 模式下的解析问题
let flexLib: any = null
async function ensureLib(): Promise<any> {
  if (flexLib) return flexLib
  const mod: any = await import('flexsearch')
  flexLib = mod.default || mod
  return flexLib
}

export function useFlexSearch(source: Ref<MessageIndex[]>) {
  /** 当前搜索关键字（双向绑定到输入框） */
  const query = ref('')
  /** 经过筛选后的结果（保留原顺序） */
  const results = ref<MessageIndex[]>([])
  /** FlexSearch.Document 实例（运行时构造） */
  let index: any = null
  /** 是否已构建索引（异步加载 lib 后才可用） */
  let indexed = false

  async function buildIndex() {
    if (!source.value.length) {
      index = null
      indexed = false
      results.value = source.value
      return
    }
    // 先同步填充 results，避免异步加载 flexsearch 期间的空窗期
    // 否则首次进入 /messages?year=YYYY 时 VirtualList 不会渲染，
    // jumpToYear 因 listRef 为 null 而失效（说说左侧年份跳转失败）
    results.value = source.value
    const lib = await ensureLib()
    index = new lib.Document({
      tokenize: 'forward',
      optimize: true,
      document: {
        id: 'tid',
        index: ['title', 'time']
      }
    })
    source.value.forEach(item => index.add(item))
    indexed = true
    search(query.value)
  }

  function search(q: string) {
    const kw = (q || '').trim()
    if (!kw || !indexed || !index) {
      results.value = source.value
      return
    }
    // FlexSearch.Document.search 返回 [{ field, result: [id] }]，需合并多字段命中
    const rs = index.search(kw)
    const idSet = new Set<string>()
    rs.forEach((r: any) => {
      (r.result || []).forEach((id: string) => idSet.add(String(id)))
    })
    // 保留原顺序，避免搜索后顺序跳动
    results.value = source.value.filter(item => idSet.has(String(item.tid)))
  }

  watch(source, () => {
    buildIndex()
  }, { immediate: true, deep: false })

  watch(query, () => search(query.value))

  return { query, results }
}
