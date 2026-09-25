/**
 * ESLint flat config（P1-5 质量门禁）
 * 范围：main / preload / shared / scripts（JS）+ renderer（TS/Vue）
 * 豁免：src/engine（P2 逐字搬迁区，词法全局跨文件引用，不参与 lint）
 */
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'src/renderer/dist/**',
      'src/engine/**',
      'docs/**',
      // 自包含子项目：有独立 vue-tsc/vite 门禁（v5.2 S1 取回的归档 SPA 前端源码）
      'archive-viewer/**',
    ],
  },

  // TS / Vue：recommended 基线
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
      // catch 兜底变量（catch (e) 不使用）是既有容错模式，不视为未用
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // Node 侧（main/preload/shared/scripts/tests）
  {
    files: [
      'src/main/**/*.js',
      'src/preload/**/*.mjs',
      'src/shared/**/*.mjs',
      'scripts/**/*.mjs',
      'tests/**/*.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // 渲染层
  {
    files: ['src/renderer/src/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // 存量：IPC payload / 引擎配置声明为 any（env.d.ts、stores）——P3 类型收紧阶段升回 error
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
