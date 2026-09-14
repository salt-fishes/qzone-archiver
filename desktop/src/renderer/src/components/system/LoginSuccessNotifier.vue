<script lang="ts">
/**
 * 扫码登录相关提示（v4.7 反馈 ④⑤）
 *
 * ④ 登录成功后提示「N 秒后自动最小化窗口并进入备份」，倒计时结束导航到「新建任务」。
 * ⑤ 「勿在 QQ 空间窗口切换页面/刷新，否则引擎需重新注入、可能导致备份失败」这句
 *    挪到**打开 QQ 空间窗口之前**提示（跳转前预告），而不是登录成功后才说 ——
 *    那时用户已经点完了，提醒等于事后告知。
 *
 * 必须挂在 NMessageProvider 内部（useMessage 依赖 provider 上下文）。
 * 本组件无渲染输出，用 render 函数返回 null（空 template 会被 vue/valid-template-root 拒绝）。
 */
import { defineComponent, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';

/** 与主进程 LOGIN_MINIMIZE_DELAY_SEC 保持一致（由 main.login-notice.test.mjs 守卫） */
const LOGIN_MINIMIZE_DELAY_SEC = 3;

/** 跳转 QQ 空间前的预告文案（反馈 ⑤） */
const BEFORE_LOGIN_TIP =
  '即将打开 QQ 空间窗口扫码登录；登录完成后请勿在该窗口切换页面或手动刷新 —— ' +
  '引擎脚本注入在空间页面上，页面一旦变更多半需要重新注入，可能导致备份失败';

export default defineComponent({
  name: 'LoginSuccessNotifier',
  setup() {
    const router = useRouter();
    const message = useMessage();
    const auth = useAuthStore();

    // ⑤ 跳转前预告：loginPending 由登录入口置位
    watch(
      () => auth.auth.loginPending,
      (pending) => {
        if (!pending) return;
        message.warning(BEFORE_LOGIN_TIP, { duration: 8000, closable: true });
      }
    );

    // ④ 登录成功后倒计时提示 + 跳转
    watch(
      () => auth.auth.loginJustSucceeded,
      (just) => {
        if (!just) return;
        const seconds = auth.auth.minimizeInSec ?? LOGIN_MINIMIZE_DELAY_SEC;
        message.success(`登录成功，${seconds} 秒后自动最小化窗口并进入备份`, { duration: seconds * 1000 });
        window.setTimeout(() => {
          // 登录态已由主进程广播，这里只负责把用户带到下一步
          if (router.currentRoute.value.path !== '/new') {
            router.push('/new');
          }
          auth.clearLoginJustSucceeded();
        }, seconds * 1000);
      }
    );

    return () => null;
  },
});
</script>
