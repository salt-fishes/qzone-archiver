<script lang="ts">
/**
 * 扫码登录成功提示（v4.7 反馈 ④）
 *
 * 背景：此前登录成功后主进程静默 2 秒最小化引擎窗口，用户不知道发生了什么。
 * 现在改为：登录成功 → 顶部提示「登录成功，N 秒后自动最小化…」→ 倒计时结束
 * 导航到「新建任务」并提示可开始备份。
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

export default defineComponent({
  name: 'LoginSuccessNotifier',
  setup() {
    const router = useRouter();
    const message = useMessage();
    const auth = useAuthStore();

    watch(
      () => auth.auth.loginJustSucceeded,
      (just) => {
        if (!just) return;
        const seconds = auth.auth.minimizeInSec ?? LOGIN_MINIMIZE_DELAY_SEC;
        // v4.7 反馈 ⑤：一并提示「别在引擎窗口里乱点」——页面一旦跳走/重载，
        // 注入到 qzone 页面的引擎脚本会失效，备份会报「引擎任务层未就绪」。
        message.success('登录成功，3 秒后自动最小化窗口并进入备份', { duration: seconds * 1000 });
        message.warning('备份期间请勿在 QQ 空间窗口中切换页面或手动刷新，否则引擎需要重新注入，可能导致备份失败', {
          duration: seconds * 1000 + 6000,
        });
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
