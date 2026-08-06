/**
 * 配置 / 引擎存储持久化（userData/state/）
 * - config.json       UI 配置（config:get/set 等）
 * - engine-storage.json  引擎 storage（QZone_Config / Backedup 等，等价 chrome.storage）
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function stateDir() {
  return path.join(app.getPath('userData'), 'state');
}

function configFile() {
  return path.join(stateDir(), 'config.json');
}

function engineStorageFile() {
  return path.join(stateDir(), 'engine-storage.json');
}

function ensureDir() {
  fs.mkdirSync(stateDir(), { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('[config-store] 读取失败', file, e);
  }
  return fallback;
}

function writeJson(file, data) {
  ensureDir();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export const configStore = {
  get() {
    return readJson(configFile(), {});
  },
  set(partial) {
    const next = { ...this.get(), ...(partial || {}) };
    writeJson(configFile(), next);
    return next;
  },
  reset(defaults = {}) {
    writeJson(configFile(), defaults);
    return defaults;
  },
  filePath() {
    return configFile();
  },
};

/** 引擎 storage：一个扁平 JSON map（键 → 值） */
export const engineStorage = {
  filePath() {
    return engineStorageFile();
  },
  load() {
    return readJson(engineStorageFile(), {});
  },
  get(keys) {
    const map = this.load();
    if (keys === null || keys === undefined) {
      return map;
    }
    const out = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      out[key] = map[key];
    }
    return out;
  },
  set(items) {
    const map = this.load();
    for (const [key, value] of Object.entries(items || {})) {
      map[key] = value;
    }
    writeJson(engineStorageFile(), map);
    return map;
  },
  remove(keys) {
    const map = this.load();
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete map[key];
    }
    writeJson(engineStorageFile(), map);
    return map;
  },
};
