import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// v5.1 R3 渲染层拆包：第三方库与业务代码分离（主 chunk 原 ~1,047 KB > 500 KB 警告线）。
// 分组约束：
// - vue/@vue/vue-router/pinia 必须同 chunk —— 它们相互循环引用，拆开会有跨 chunk 初始化顺序（TDZ）风险；
// - naive-ui 连同其支撑库（css-render/vueuc/treemate 等）同 chunk —— 同为单向依赖 vue，成组避免碎 chunk 间环。
const VENDOR_NAIVE_UI = /[\\/]node_modules[\\/](naive-ui|@css-render|vueuc|treemate|vooks|vdirs|seemly|evtd|date-fns|@floating-ui)/;
const VENDOR_MOTION = /[\\/]node_modules[\\/](motion-v|@motion-v|motion|framer-motion|hey-listen)/;
const VENDOR_VUE = /[\\/]node_modules[\\/](vue|@vue|vue-router|pinia)/;

function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (VENDOR_NAIVE_UI.test(id)) return 'vendor-naive-ui';
  if (VENDOR_MOTION.test(id)) return 'vendor-motion-v';
  if (VENDOR_VUE.test(id)) return 'vendor-vue';
  return 'vendor-misc';
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [vue()],
  build: {
    outDir: path.resolve(__dirname, 'src/renderer/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
      output: { manualChunks },
    },
  },
  server: {
    port: 5176,
  },
});
