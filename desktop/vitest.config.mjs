/**
 * vitest 独立配置（P1-5 质量门禁）
 * 不继承 vite.config.ts（其 root 指向 src/renderer）：
 * 测试文件位于 tests/unit，Node 环境运行。
 *
 * v4.7.4：加入 @vitejs/plugin-vue —— 表情渲染测试需要真渲染 .vue 组件
 * （此前配置注释写的是"无需 vue 插件"，但纯逻辑测试无法覆盖组件渲染 bug）。
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
  },
});
