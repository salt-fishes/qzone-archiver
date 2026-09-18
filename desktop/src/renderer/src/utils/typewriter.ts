/**
 * §H：打字机状态机（纯逻辑，便于单测）——打字 → 停留 → 删字 → 下一条，循环。
 * 组件（TypewriterText.vue）只负责定时驱动与渲染；步进与延迟全部在这里算好。
 */

export type TypewriterOptions = {
  typeMs?: number;
  holdMs?: number;
  deleteMs?: number;
  startDelay?: number;
};

export type TypewriterPhase = 'typing' | 'holding' | 'deleting';

export function createTypewriter(phrases: string[], opts: TypewriterOptions = {}) {
  const typeMs = opts.typeMs ?? 70;
  const holdMs = opts.holdMs ?? 1400;
  const deleteMs = opts.deleteMs ?? 35;
  const startDelay = opts.startDelay ?? 300;

  let idx = 0;
  let len = 0;
  let phase: TypewriterPhase = 'typing';

  return {
    get index() {
      return idx;
    },
    get phase() {
      return phase;
    },
    /** 当前应显示的文本 */
    get text() {
      return (phrases[idx] || '').slice(0, len);
    },
    /**
     * 推进一个渲染步，返回下一次步进的延迟 ms。
     * 单条完成 → 停留 → 删空 → 切下一条（循环）。
     */
    step(): number {
      const target = (phrases[idx] || '').length;
      if (phase === 'typing') {
        if (len < target) {
          len += 1;
          return typeMs;
        }
        phase = 'holding';
        return holdMs;
      }
      if (phase === 'holding') {
        phase = 'deleting';
        return deleteMs;
      }
      // deleting
      if (len > 0) {
        len -= 1;
        return deleteMs;
      }
      idx = (idx + 1) % phrases.length;
      phase = 'typing';
      return startDelay;
    },
  };
}
