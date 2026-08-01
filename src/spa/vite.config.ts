import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// ESM 兼容：__dirname 在 "type": "module" 下不可用
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 修复 Vite 生成的 index.html，使其在 file:// 协议下可正常加载
 *
 * 问题：Vite 默认输出 <script type="module" crossorigin> 和 <link crossorigin>，
 *   在 file:// 协议下 Chrome 会强制 CORS 检查（origin=null），导致 ERR_FAILED。
 *
 * 修复：去掉 type="module" 和 crossorigin 属性，删除 modulepreload 标签。
 *   IIFE 格式的 JS 不需要 module，普通 <script> 即可加载。
 */
function fixHtmlForFileProtocol(): PluginOption {
  return {
    name: 'fix-html-for-file-protocol',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        return html
          // <script type="module" crossorigin src="..."> → <script defer src="...">
          // 加 defer：IIFE 在 <head> 同步执行时 <body> 未解析，#app 为 null，
          //   Vue mount 调用 appendChild 报 "Cannot read properties of null"
          //   defer 让脚本在 DOM 解析完成后执行，确保 #app 已存在
          .replace(/<script\s+type="module"\s+crossorigin\s+src=/g, '<script defer src=')
          // <link rel="stylesheet" crossorigin href="..."> → <link rel="stylesheet" href="...">
          .replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href=/g, '<link rel="stylesheet" href=')
          // 删除 modulepreload 标签（file:// 下无法用 module 加载分包）
          .replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, '')
      }
    }
  }
}

// SPA 构建产物输出到 src/export/spa-dist/
// 由扩展端 exportUserToSpa 复制到备份 ZIP 内 Common/spa/ 共享给各模块引用
export default defineConfig({
  plugins: [
    vue(),
    fixHtmlForFileProtocol(),
    {
      // CSS 中字体/图片引用会被 Vite 自动加上 ?hash 查询串（如 ./lg.ttf?io9a6k）
      // file:// 协议下浏览器会按字面路径查找，导致 ./lg.ttf?io9a6k 404
      // 这里在文件全部写入磁盘后去掉 CSS url() 中的查询串，保证 file:// 可加载
      name: 'strip-css-url-hash',
      apply: 'build',
      closeBundle() {
        const cssPath = resolve(__dirname, '../export/spa-dist/assets/style.css')
        if (existsSync(cssPath)) {
          const css = readFileSync(cssPath, 'utf8')
          // 仅去除本地相对路径 url(./xxx?hash) 中的 ?hash，不影响 http(s):// 和 data:
          const fixed = css.replace(
            /url\((\.\.\/[^?#)]+|\.\/[^?#)]+)(\?[^)]*)?\)/g,
            (_m, p1) => `url(${p1})`
          )
          writeFileSync(cssPath, fixed)
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // 相对路径，支持 file:// 协议直接打开
  base: './',
  server: {
    port: 5175,
    strictPort: true
  },
  build: {
    outDir: '../export/spa-dist',
    // outDir 位于项目根之外，默认不清空，须显式开启避免旧产物（含测试数据）残留
    emptyOutDir: true,
    // target 不能高于 es2018（IIFE 兼容性）
    target: 'es2018',
    // CSS 合并到单个 style.css 文件
    cssCodeSplit: false,
    // 关闭文件名 hash：备份 ZIP 是一次性产物，固定名便于扩展端按清单复制
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        // IIFE 格式：生成 <script>（非 module），file:// 协议下不受 CORS 拦截
        // ES module 在 file:// 下会被 Chrome 强制 CORS 检查（origin=null），导致 ERR_FAILED
        format: 'iife',
        // 合并所有动态 import() 到主 bundle
        // 消除 vendor.js / gallery.js / scroller.js / search.js 等分包
        // 代价：单个 index.js 体积增大约 300KB（gzip ~95KB），但换取 file:// 直开兼容
        inlineDynamicImports: true,
        entryFileNames: 'assets/index.js',
        assetFileNames: 'assets/[name].[ext]'
        // 注意：format=iife + inlineDynamicImports 时不能使用 manualChunks / chunkFileNames
      }
    }
  }
})
