/**
 * vitest 独立配置（P1-5 质量门禁）
 * 不继承 vite.config.ts（其 root 指向 src/renderer）：
 * 测试文件位于 tests/unit，Node 环境运行，无需 vue 插件。
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
  },
});
