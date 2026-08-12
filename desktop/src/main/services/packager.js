/**
 * 打包器（主进程）——M2b 实现
 * archiver 流式 zip + 进度回调（zip:progress），替代扩展端 JSZip。
 * 备份目录 → 单一 zip 文件；大目录流式压缩，内存恒定。
 */
import { ZipArchive } from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { sendToUi } from './engine-bridge.js';

function sendProgress(percent, current) {
  sendToUi('zip:progress', { percent, current });
}

export const packager = {
  /**
   * 打包目录到 zip
   * @param {{ srcDir: string, destPath: string, baseName?: string }} p
   * @returns {Promise<{ path: string, bytes: number, files: number }>}
   */
  async createZip({ srcDir, destPath, baseName }) {
    const root = path.resolve(srcDir);
    if (!fs.existsSync(root)) {
      throw new Error(`源目录不存在: ${srcDir}`);
    }
    fs.mkdirSync(path.dirname(path.resolve(destPath)), { recursive: true });

    const output = fs.createWriteStream(destPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    // 总字节数（用于进度）
    const totalBytes = calcDirBytes(root);

    return new Promise((resolve, reject) => {
      let bytes = 0;
      let files = 0;
      let lastPercent = -1;
      let lastReport = 0;

      archive.on('entry', (entry) => {
        // entry 事件在文件写入前触发；此处仅统计文件数
        if (entry.type === 'file') files += 1;
      });

      // progress 事件（archiver v6+）提供 processedBytes/entries
      archive.on('progress', (data) => {
        bytes = data.fs && data.fs.processedBytes ? data.fs.processedBytes : bytes;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((bytes / totalBytes) * 100)) : 0;
        const now = Date.now();
        // 节流：≥500ms 或 ≥5%
        if (now - lastReport >= 500 || percent - lastPercent >= 5) {
          lastReport = now;
          lastPercent = percent;
          sendProgress(percent, archive.pointer());
        }
      });

      output.on('close', () => {
        sendProgress(100, archive.pointer());
        resolve({ path: destPath, bytes: archive.pointer(), files });
      });
      archive.on('error', (err) => reject(err));
      output.on('error', (err) => reject(err));

      archive.pipe(output);
      // 以根目录名作为 zip 内顶层目录（如 'QQ空间备份_uin'），不含绝对路径
      const topName = baseName || path.basename(root);
      archive.directory(root, topName);
      archive.finalize();
    });
  },
};

/** 递归统计目录字节数（zip 进度分母） */
function calcDirBytes(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += calcDirBytes(p);
      } else if (entry.isFile()) {
        total += fs.statSync(p).size;
      }
    }
  } catch (e) {
    /* 单文件失败不阻塞 */
  }
  return total;
}
