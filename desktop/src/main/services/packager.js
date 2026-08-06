/**
 * 打包器（主进程）——M2b 实现
 * M2a/P1：占位。M2b 使用 archiver 流式打包 + manifest/checksum/report（引擎 packagers/manifest.js 配合）
 */
export const packager = {
  async createZip({ srcDir, destPath }) {
    throw new Error('打包功能 M2b 实现，当前不可用');
  },
};
