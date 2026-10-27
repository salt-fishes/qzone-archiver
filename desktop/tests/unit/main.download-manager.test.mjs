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
  await downloadManager.resumeAll();
  downloadManager.setDrainListener(null);
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

  it('任务切换后旧任务保持暂停，新任务不受影响（v5.5 M1 决策 D12）', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await downloadManager.pause();
    await enqueueTask('t2-dl-a');
    expect(stateById()['t2-dl-a']).toBe('pending');
    // 新备份 B 启动：旧任务 A 仍暂停（由 pauseOthers 显式暂停），B 正常调度
    mocks.activeCtx = { taskId: 'task-B', targetDir: tmpDir };
    await downloadManager.pauseOthers('task-B');
    await enqueueTask('t2-dl-b');
    const st = stateById();
    expect(st['t2-dl-b']).toBe('running');
    expect(st['t2-dl-a']).toBe('pending'); // A 保持暂停，待 B 完成后 resumeOthers
  });

  it('独立暂停（无活跃备份）只影响无任务归属的记录', async () => {
    mocks.activeCtx = { taskId: null, targetDir: tmpDir };
    await downloadManager.pause(); // 绑定独立哨兵
    await enqueueTask('t3-dl');
    expect(stateById()['t3-dl']).toBe('pending');
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await enqueueTask('t3-dl-2');
    expect(stateById()['t3-dl-2']).toBe('running');
    expect(stateById()['t3-dl']).toBe('pending');
  });

  it('pauseOthers / resumeOthers 按任务暂停与恢复（D12/D13）', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await enqueueTask('old-a');
    mocks.activeCtx = { taskId: 'task-B', targetDir: tmpDir };

    await downloadManager.pauseOthers('task-B');
    expect(downloadManager.getState().pausedTasks).toContain('task-A');
    await enqueueTask('new-b');
    expect(stateById()['new-b']).toBe('running');

    await downloadManager.resumeOthers('task-B');
    expect(downloadManager.getState().pausedTasks).not.toContain('task-A');
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

describe('v4.9.2 槽位记账与队列清理', () => {
  it('大文件下载完成后归还常规槽位（slotBig 派发时记账；isBig 翻转不再泄漏 running）', async () => {
    // 复现实机冻结根因：入队时 totalBytes=0（常规槽位），_attempt 下载中更新为
    // 真实大小 >50MB；若 finally 按 isBig 重新判定，会漏还常规槽位——
    // 10 个大文件下完后 running 永久占满，队列静默冻结。
    const spy = vi.spyOn(downloadManager, '_attempt').mockImplementation(async (record) => {
      record.totalBytes = 60 * 1024 * 1024;
      record.state = 'done'; // 真实 _attempt 完成时自行置 done，stub 同样置态
    });
    try {
      mocks.activeCtx = { taskId: 'task-big', targetDir: tmpDir };
      for (let i = 0; i < 10; i++) await enqueueTask(`big-${i}`);
      await vi.waitFor(() => expect(stateById()['big-9']).toBe('done'));
      // 泄漏场景下 running 恒为 10，此条将永远 pending；修复后应被派发（stub 同步完成 → done）
      await enqueueTask('after-big');
      await vi.waitFor(() => expect(stateById()['after-big']).toBe('done'));
    } finally {
      spy.mockRestore();
    }
  });

  it('新任务启动只清其他任务的终态记录，保留未完成任务（v5.5 M1 决策 D12）', async () => {
    mocks.activeCtx = { taskId: 'task-old', targetDir: tmpDir };
    await enqueueTask('old-done');
    await enqueueTask('old-pending');
    // 人工置态（mock net.fetch 抛错走重试，直接改状态避免等待退避）
    const q = downloadManager.getState().queue;
    q.find((x) => x.id === 'old-done').state = 'done';
    q.find((x) => x.id === 'old-pending').state = 'pending';

    // 新备份启动（activeCtx 已切换）→ 旧任务终态清除，pending 保留待恢复
    mocks.activeCtx = { taskId: 'task-new', targetDir: tmpDir };
    downloadManager.purgeFinished();
    const st = stateById();
    expect(st['old-done']).toBeUndefined();
    expect(st['old-pending']).toBe('pending');
  });

  it('当前任务自己的记录不受 purgeFinished 影响', async () => {
    mocks.activeCtx = { taskId: 'task-cur', targetDir: tmpDir };
    await enqueueTask('cur-a');
    downloadManager.purgeFinished();
    expect(stateById()['cur-a']).toBeDefined();
  });
});

describe('v5.4 收尾等待可见化（waitIdle）', () => {
  it('队列排空：onTick 收到 0/0，返回 true', async () => {
    // 前置：上一条用例遗留的退避重试（cancelRequested）≤2s 转 failed，等队列真正排空
    await vi.waitFor(() => {
      const busy = downloadManager.getState().queue
        .filter((q) => q.state === 'pending' || q.state === 'running').length;
      expect(busy).toBe(0);
    }, { timeout: 4000, interval: 100 });

    // 下载直接成功（避免 mock 网络抛错触发的退避重试与手动置态竞争）
    const spy = vi.spyOn(downloadManager, '_attempt').mockImplementation(async (record) => {
      record.state = 'done';
    });
    try {
      mocks.activeCtx = { taskId: 'task-w', targetDir: tmpDir };
      await enqueueTask('w-done');
      await vi.waitFor(() => expect(stateById()['w-done']).toBe('done'));

      const ticks = [];
      const ok = await downloadManager.waitIdle(1000, (c) => ticks.push(c));
      expect(ok).toBe(true);
      expect(ticks.at(-1)).toMatchObject({ pending: 0, running: 0 });
    } finally {
      spy.mockRestore();
    }
  });

  it('队列未排空：超时返回 false，onTick 携带剩余计数，收尾提示同时进 UI 日志', async () => {
    mocks.activeCtx = { taskId: 'task-w2', targetDir: tmpDir };
    await enqueueTask('w-slow'); // mock net.fetch 抛错 → 退避重试中，保持 pending/running

    const ticks = [];
    const ok = await downloadManager.waitIdle(600, (c) => ticks.push(c));
    expect(ok).toBe(false);
    expect(ticks.length).toBeGreaterThan(0);
    const last = ticks.at(-1);
    expect(last.pending + last.running).toBeGreaterThan(0);
    // 收尾生命周期行双轨：任务日志（downloadLog）+ UI 日志（backup:log 推送）
    const uiLogs = mocks.sendToUi.mock.calls
      .filter(([ch]) => ch === 'backup:log')
      .map(([, p]) => p.message);
    expect(uiLogs.some((m) => /等待下载队列落盘/.test(m))).toBe(true);
    expect(uiLogs.some((m) => /下载收尾等待超时/.test(m))).toBe(true);
  });
});

describe('v5.5 M1 失败重试与排空通知', () => {
  it('retryFailed 只重置指定任务的失败项，清空错误与重试计数', async () => {
    mocks.activeCtx = { taskId: 'task-A', targetDir: tmpDir };
    await downloadManager.pause(); // 保持 pending，避免 pump 立刻派发
    await enqueueTask('rf-1');
    await enqueueTask('rf-2');
    const qs = downloadManager.getState().queue;
    const q1 = qs.find((q) => q.id === 'rf-1');
    q1.state = 'failed';
    q1.error = 'HTTP 500';
    q1.retries = 4;
    // 其他任务的失败项：不应被 task-A 的重试影响
    mocks.activeCtx = { taskId: 'task-B', targetDir: tmpDir };
    await downloadManager.pause();
    await enqueueTask('rf-other');
    const other = downloadManager.getState().queue.find((q) => q.id === 'rf-other');
    other.state = 'failed';
    other.error = 'HTTP 503';

    const n = await downloadManager.retryFailed('task-A');
    expect(n).toBe(1);
    const after = Object.fromEntries(downloadManager.getState().queue.map((q) => [q.id, q]));
    expect(after['rf-1']).toMatchObject({ state: 'pending', error: null, retries: 0 });
    expect(after['rf-other']).toMatchObject({ state: 'failed', error: 'HTTP 503' });
  });

  it('retryFailed 无失败项返回 0', async () => {
    expect(await downloadManager.retryFailed()).toBe(0);
  });

  it('任务最后一条下载结束 → 排空回调触发一次；有 pending 时不触发', async () => {
    mocks.activeCtx = { taskId: 'task-D', targetDir: tmpDir };
    const onDrain = vi.fn();
    downloadManager.setDrainListener(onDrain);
    await downloadManager.pause();
    await enqueueTask('drain-1');
    await enqueueTask('drain-2');

    expect(downloadManager.checkTaskDrained('task-D')).toBe(false); // 仍有 pending
    const qs = downloadManager.getState().queue;
    qs.find((q) => q.id === 'drain-1').state = 'done';
    qs.find((q) => q.id === 'drain-2').state = 'done';

    expect(downloadManager.checkTaskDrained('task-D')).toBe(true);
    expect(onDrain).toHaveBeenCalledTimes(1);
    expect(onDrain).toHaveBeenCalledWith('task-D');
    // 同一排空周期不重复通知
    expect(downloadManager.checkTaskDrained('task-D')).toBe(false);
    expect(onDrain).toHaveBeenCalledTimes(1);
  });

  it('无注册回调 / 无记录时不触发', async () => {
    downloadManager.setDrainListener(null);
    expect(downloadManager.checkTaskDrained('task-none')).toBe(false);
  });
});
