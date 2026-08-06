/**
 * 主进程路径常量
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 引擎目录（desktop/src/engine） */
export const ENGINE_DIR = path.join(__dirname, '../engine');
