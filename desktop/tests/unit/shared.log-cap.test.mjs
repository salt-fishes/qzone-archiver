/**
 * v4.9.2 log-cap：日志长度兜底截断
 * 短文本原样透传；超长截断到上限并标注原始长度。
 */
import { describe, it, expect } from 'vitest';
import { capLog, MAX_LOG_LEN } from '../../src/shared/log-cap.mjs';

describe('capLog 截断兜底', () => {
  it('短文本原样返回', () => {
    expect(capLog('普通日志')).toBe('普通日志');
    expect(capLog('')).toBe('');
    expect(capLog(null)).toBe('');
  });

  it('恰好在阈值内不截断', () => {
    const s = 'a'.repeat(MAX_LOG_LEN);
    expect(capLog(s)).toBe(s);
  });

  it('超长截断并标注原始长度', () => {
    const s = 'b'.repeat(3000);
    const out = capLog(s);
    expect(out.startsWith('b'.repeat(MAX_LOG_LEN))).toBe(true);
    expect(out).toContain('原始长度 3000 字符');
    expect(out.length).toBeLessThan(MAX_LOG_LEN + 60);
  });
});
