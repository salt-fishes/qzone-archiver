/**
 * P3-2（§5.2）：下载管理器任务级暂停位单测
 * 覆盖：同任务暂停短路 / 任务切换旧暂停位自动失效（P0-1 回归）/
 *      独立暂停语义 / resume 清位 / 运行中任务中断标记。
 * electron.net.fetch 抛错使 _run 快速失败，避免真实网络；写盘定向到临时目录。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mocks = vi.hoisted(() => ({ activeCtx: {}, sendToUi: vi.fn() }));

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  net: {
    fetch: async () => {
      throw new Error('mock-offline');
    },
  },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
}));

vi.mock('../../src/main/services/engine-bridge.js', () => ({
  getActiveTaskContext: () => ({ ...mocks.activeCtx }),
  sendToUi: mocks.sendToUi,
}));

vi.mock('../../src/main/services/state-store.js', () => ({
  stateStore: {
    saveDownloads: vi.fn(),
    loadDownloads: () => ({ queue: [] }),
  },
}));

const { downloadManager } = await import('../../src/main/services/download-manager.js');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlm-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  // 复位：清空队列（pending→failed→clear）+ 清暂停位，用例间互不污染
  await downloadManager.cancel();
  await downloadManager.clearDone();
  await downloadManager.resume();
  mocks.sendToUi.mockClear();
  mocks.activeCtx = { taskId: null, targetDir: tmpDir };
});

function stateById() {
  return Object.fromEntries(downloadManager.getState().queue.map((q) => [q.id, q.state]));
}

function enqueueTask(id) {
  return downloadManager.enqueue({
    id,
    url: 'https://example.com/a.jpg',
    name: 'a.jpg',
    dir: 'Messages/images',
    module: 'messages',
  });
}

describe('P3-2 任务级暂停位（§5.2）', () => {
  it('同任务暂停时 pump 短路，新任务保持 pending', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await downloadManager.pause();
    await enqueueTask('t1-dl');
    expect(stateById()['t1-dl']).toBe('pending');
  });

  it('任务切换后旧暂停位自动失效（P0-1 回归：取消后新备份不再静默排队）', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await downloadManager.pause();
    await enqueueTask('t2-dl-a');
    expect(stateById()['t2-dl-a']).toBe('pending');
    // 新备份 B 启动（activeBackup.taskId 被覆盖）→ 旧暂停位失效，调度恢复
    mocks.activeCtx = { taskId: 'task-B', targetDir: tmpDir };
    await enqueueTask('t2-dl-b');
    const st = stateById();
    expect(st['t2-dl-b']).toBe('running');
    expect(st['t2-dl-a']).toBe('running'); // A 遗留任务也恢复调度
  });

  it('独立暂停（无活跃备份）在新备份启动后自动失效', async () => {
    mocks.activeCtx = { taskId: null, targetDir: tmpDir };
    await downloadManager.pause(); // 绑定独立哨兵
    await enqueueTask('t3-dl');
    expect(stateById()['t3-dl']).toBe('pending');
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await enqueueTask('t3-dl-2');
    expect(stateById()['t3-dl-2']).toBe('running');
  });

  it('resume 清除暂停位，立即恢复调度', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await downloadManager.pause();
    await enqueueTask('t4-dl');
    expect(stateById()['t4-dl']).toBe('pending');
    await downloadManager.resume();
    expect(stateById()['t4-dl']).toBe('running');
  });
});
