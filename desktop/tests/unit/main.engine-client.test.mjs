/**
 * v5.5 M1：EngineClient 单测
 * 覆盖：start 等 started 事实 / 启动超时 / bridge.start 失败清理 /
 *       控制命令 seq 与参数 / 协议版本不匹配拒绝启动
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
}));

vi.mock('../../src/main/services/engine-bridge.js', () => ({
  engineBridge: { start: vi.fn(), command: vi.fn() },
}));

const { createEngineClient } = await import('../../src/main/services/engine-client.js');

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('EngineClient.start', () => {
  it('发出 start 后等待 started 事实，收到后 resolve', async () => {
    const bridge = { start: vi.fn().mockResolvedValue(undefined), command: vi.fn() };
    const client = createEngineClient({ bridge, timeouts: { startMs: 100 }, log: silentLog });

    const pending = client.start({ taskId: 'task-1' });
    await Promise.resolve();
    expect(bridge.start).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(client.getSnapshot().waitingTasks).toEqual(['task-1']);

    client.onFact({ type: 'started', taskId: 'task-1', v: 2 });
    await expect(pending).resolves.toMatchObject({ type: 'started', taskId: 'task-1' });
    expect(client.getSnapshot().waitingTasks).toEqual([]);
  });

  it('started 超时 → reject，且清理等待者', async () => {
    const bridge = { start: vi.fn().mockResolvedValue(undefined), command: vi.fn() };
    const client = createEngineClient({ bridge, timeouts: { startMs: 20 }, log: silentLog });

    await expect(client.start({ taskId: 'task-2' })).rejects.toThrow('引擎启动确认超时');
    expect(client.getSnapshot().waitingTasks).toEqual([]);
  });

  it('bridge.start 抛错 → reject，且清理等待者', async () => {
    const bridge = {
      start: vi.fn().mockRejectedValue(new Error('bridge boom')),
      command: vi.fn(),
    };
    const client = createEngineClient({ bridge, timeouts: { startMs: 100 }, log: silentLog });

    await expect(client.start({ taskId: 'task-3' })).rejects.toThrow('bridge boom');
    expect(client.getSnapshot().waitingTasks).toEqual([]);
  });

  it('其他任务的 started 不会误唤醒当前等待', async () => {
    const bridge = { start: vi.fn().mockResolvedValue(undefined), command: vi.fn() };
    const client = createEngineClient({ bridge, timeouts: { startMs: 40 }, log: silentLog });

    const pending = client.start({ taskId: 'task-4' });
    await Promise.resolve();
    client.onFact({ type: 'started', taskId: 'task-other' });
    await expect(pending).rejects.toThrow('引擎启动确认超时');
  });
});

describe('EngineClient.command', () => {
  it('控制命令按 seq 递增并透传参数', async () => {
    const bridge = { start: vi.fn(), command: vi.fn().mockResolvedValue({ ok: true }) };
    const logs = [];
    const client = createEngineClient({ bridge, log: { info: (m) => logs.push(m) } });

    await client.command('pause');
    await client.command('resume');
    await client.command('cancel');

    expect(bridge.command.mock.calls).toEqual([
      ['pause', ''],
      ['resume', ''],
      ['cancel', ''],
    ]);
    expect(logs[0]).toContain('seq=1');
    expect(logs[1]).toContain('seq=2');
    expect(logs[2]).toContain('seq=3');
  });
});

describe('协议版本', () => {
  it('engine 版本与 main 不一致时拒绝启动', async () => {
    const bridge = { start: vi.fn(), command: vi.fn() };
    const client = createEngineClient({ bridge, log: silentLog });
    client.setProtocolVersion(1);

    await expect(client.start({ taskId: 'task-5' })).rejects.toThrow('引擎协议版本不匹配');
    expect(bridge.start).not.toHaveBeenCalled();
  });

  it('版本未知（0）时不阻断，started/heartbeat 会补写版本', () => {
    const client = createEngineClient({ bridge: { start: vi.fn(), command: vi.fn() }, log: silentLog });
    expect(client.getSnapshot().protocolVersion).toBe(0);
    client.setProtocolVersion(2);
    expect(client.getSnapshot().protocolVersion).toBe(2);
  });
});
