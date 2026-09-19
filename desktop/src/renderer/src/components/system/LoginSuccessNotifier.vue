<script lang="ts">
/**
 * 扫码登录相关提示（v4.7 反馈 ④⑤ / v4.9 §E）
 *
 * §E 变化：扫码前注意事项（勿切页面/刷新 + 会自动最小化）合并为**一个原生模态**，
 * 由主进程弹在 QQ 空间窗口正上方（auth.js BEFORE_LOGIN_NOTICE），不再经主窗口 toast——
 * 此前两条 toast 都被 1280×900 的引擎窗整体盖住。
 * 本组件只保留：
 *  ④ 登录成功后倒计时结束导航到「新建任务」；
 *  §E 订阅 auth:login-notice（主进程在引擎窗**最小化之后**推送）再显示成功提示，
 *     此时主窗口 toast 不再被引擎窗遮挡，也不会 3 秒闪没（无倒计时文案，读不丢失）。
 *
 * 必须挂在 NMessageProvider 内部（useMessage 依赖 provider 上下文）。
 * 本组件无渲染输出，用 render 函数返回 null（空 template 会被 vue/valid-template-root 拒绝）。
 */
import { defineComponent, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';

/** 与主进程 LOGIN_MINIMIZE_DELAY_SEC 保持一致（由 main.login-notice.test.mjs 守卫） */
const LOGIN_MINIMIZE_DELAY_SEC = 3;

export default defineComponent({
  name: 'LoginSuccessNotifier',
  setup() {
    const router = useRouter();
    const message = useMessage();
    const auth = useAuthStore();

    // ④ 登录成功后倒计时跳转（成功提示由 auth:login-notice 在最小化后推送）。
    // v4.9.1：跳转前等昵称就绪（引擎注入完成后才能取到），避免落在新建任务页时
    // 本人卡片还是 QQ 号；昵称 10s 内仍未就绪则照常跳转（ensureProfile 会后台补齐）
    watch(
      () => auth.auth.loginJustSucceeded,
      (just) => {
        if (!just) return;
        const seconds = auth.auth.minimizeInSec ?? LOGIN_MINIMIZE_DELAY_SEC;
        const startedAt = Date.now();
        const go = () => {
          if (router.currentRoute.value.path !== '/new') {
            router.push('/new');
          }
          auth.clearLoginJustSucceeded();
        };
        const waitProfile = () => {
          if (auth.auth.nickname || Date.now() - startedAt > 10000) {
            go();
            return;
          }
          window.setTimeout(waitProfile, 500);
        };
        window.setTimeout(waitProfile, seconds * 1000);
      }
    );

    // §E：引擎窗最小化后显示登录成功提示
    const unsub = window.api.on('auth:login-notice', (p: { message?: string }) => {
      message.success(p?.message || '登录成功，QQ 空间窗口已最小化，可以开始备份了');
    });
    onBeforeUnmount(() => unsub());

    return () => null;
  },
});
</script>
