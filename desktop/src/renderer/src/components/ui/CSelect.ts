/**
 * 自定义下拉（替代原生 select，避免打开选项列表时的系统蓝底）
 * 列表 Teleport 到 body + fixed 定位 + 触发元素坐标，避免被滚动容器裁剪。
 * 样式依赖全局 tokens（.cs/.cs-list 定义在 App.vue 全局样式区）。
 * 注意：Vue 为 runtime-only 构建，不能用内联 template 字符串，必须用 h() 渲染函数。
 * 供备份向导（ModulePicker）与设置模态（App.vue）共用。
 */
import { ref, onMounted, onUnmounted, h, Teleport, defineComponent } from 'vue';

export const CSelect = defineComponent({
  name: 'CSelect',
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as () => (string | number)[], default: () => [] },
    labelMap: { type: Object, default: () => ({}) },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const open = ref(false);
    const root = ref<HTMLElement | null>(null);
    const listEl = ref<HTMLElement | null>(null);
    const listPos = ref<Record<string, string>>({});
    const onDocClick = (e: MouseEvent) => {
      // 列表 Teleport 到 body，点击外部判断需同时覆盖触发元素与列表本身
      const t = e.target as Node;
      if (root.value && !root.value.contains(t) && listEl.value && !listEl.value.contains(t)) open.value = false;
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open.value = false;
    };
    const close = () => (open.value = false);
    /** 打开时按触发元素视口坐标定位，下方空间不足则向上展开 */
    function openList() {
      const el = root.value;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxH = 230;
      const itemH = 31;
      const hh = Math.min(props.options.length * itemH + 8, maxH);
      const below = window.innerHeight - r.bottom - 8;
      const pos: Record<string, string> = { left: `${r.left}px`, width: `${r.width}px`, maxHeight: `${hh}px` };
      if (below >= hh) {
        pos.top = `${r.bottom + 4}px`;
      } else if (r.top - 8 >= 60) {
        pos.bottom = `${window.innerHeight - r.top + 4}px`;
        pos.maxHeight = `${Math.min(hh, r.top - 8)}px`;
      } else {
        pos.top = `${r.bottom + 4}px`;
        pos.maxHeight = `${Math.max(below, 60)}px`;
      }
      listPos.value = pos;
      open.value = true;
    }
    onMounted(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onEsc);
      document.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
    });
    onUnmounted(() => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    });
    const labelOf = (v: string | number) => (props.labelMap as Record<string, string>)[String(v)] ?? String(v);
    const pick = (v: string | number) => {
      emit('update:modelValue', v);
      open.value = false;
    };
    return () =>
      h('div', { class: ['cs', { open: open.value }], ref: root }, [
        h('div', { class: 'cs-val', onClick: openList }, labelOf(props.modelValue)),
        open.value
          ? h(
              Teleport,
              { to: 'body' },
              h(
                'div',
                { ref: listEl, class: 'cs-list', style: listPos.value },
                props.options.map((opt) =>
                  h(
                    'div',
                    {
                      key: String(opt),
                      class: ['cs-item', { sel: String(opt) === String(props.modelValue) }],
                      onClick: () => pick(opt),
                    },
                    labelOf(opt)
                  )
                )
              )
            )
          : null,
      ]);
  },
});
