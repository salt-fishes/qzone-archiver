/**
 * 采集目标 store（v4.6 他人模式）
 * 职责：向导第①步「备份谁的空间」的目标选择/校验状态 + 好友列表缓存
 * IPC：backup:list-friends（好友列表）、backup:validate-target（空间可访问性探测）
 * 契约：targetUin 仅随 backup:start 任务级传参，不落配置（v4.6 接口只增不改）
 */
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export type TargetMode = 'self' | 'other';

export type FriendItem = {
  uin: string;
  nickname?: string;
  remark?: string;
  avatar?: string;
};

export type TargetProfile = {
  uin: string;
  nickname?: string;
  avatar?: string;
  isOwner: boolean;
};

export const useTargetStore = defineStore('target', () => {
  /** self = 备份登录者本人；other = 备份好友公开内容 */
  const mode = ref<TargetMode>('self');
  /** 手动输入/选中的目标 QQ 号（他人模式） */
  const inputUin = ref('');
  /** 校验通过的目标资料（他人模式） */
  const profile = ref<TargetProfile | null>(null);
  const validating = ref(false);
  const validateError = ref('');

  /* -------- 好友列表（远程搜索数据源） -------- */

  const friends = ref<FriendItem[]>([]);
  const friendsLoading = ref(false);
  const friendsLoaded = ref(false);
  const friendsError = ref('');

  async function loadFriends(force = false) {
    if (friendsLoading.value) return;
    if (friendsLoaded.value && !force) return;
    friendsLoading.value = true;
    friendsError.value = '';
    try {
      const r = await window.api.backup.listFriends();
      if (r?.ok) {
        friends.value = r.friends || [];
        friendsLoaded.value = true;
        // 列表为空也视为已加载（无好友是合法状态），但给出提示
        if (!friends.value.length) friendsError.value = '好友列表为空';
      } else {
        friendsError.value = r?.error || '获取好友列表失败';
        friendsLoaded.value = false; // 失败可重试
      }
    } catch (e: any) {
      friendsError.value = e?.message || String(e);
      friendsLoaded.value = false;
    } finally {
      friendsLoading.value = false;
    }
  }

  /** 好友下拉选项：备注/昵称 + QQ 号过滤 */
  function filterFriends(query: string): FriendItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return friends.value.slice(0, 50);
    return friends.value
      .filter(
        (f) =>
          f.uin.includes(q) ||
          (f.nickname || '').toLowerCase().includes(q) ||
          (f.remark || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }

  /* -------- 目标校验 -------- */

  /**
   * 校验目标空间可访问性（返回是否可继续）
   * @param uin 缺省用 inputUin
   */
  async function validate(uin?: string): Promise<boolean> {
    const target = (uin ?? inputUin.value).replace(/\D/g, '');
    if (!target) {
      validateError.value = '请输入 QQ 号或从好友列表选择';
      return false;
    }
    inputUin.value = target;
    validating.value = true;
    validateError.value = '';
    profile.value = null;
    try {
      const r = await window.api.backup.validateTarget(target);
      if (r?.ok) {
        profile.value = {
          uin: r.uin || target,
          nickname: r.nickname,
          avatar: r.avatar,
          isOwner: !!r.isOwner,
        };
        return true;
      }
      validateError.value = r?.error || '无法访问对方空间';
      return false;
    } catch (e: any) {
      validateError.value = e?.message || String(e);
      return false;
    } finally {
      validating.value = false;
    }
  }

  function setMode(m: TargetMode) {
    mode.value = m;
    validateError.value = '';
    if (m === 'other') {
      // 进入他人模式即预取好友列表（登录者视角）
      loadFriends();
    }
  }

  function pickFriend(uin: string) {
    inputUin.value = uin;
    profile.value = null;
    validateError.value = '';
  }

  function reset() {
    mode.value = 'self';
    inputUin.value = '';
    profile.value = null;
    validateError.value = '';
  }

  /** 随 backup:start 传递的 targetUin（本人模式为 undefined，引擎行为与旧版一致） */
  const effectiveUin = computed(() =>
    mode.value === 'other' && profile.value && !profile.value.isOwner ? profile.value.uin : undefined
  );

  /** 是否处于他人模式（校验通过且确非本人） */
  const isOtherUser = computed(() => !!effectiveUin.value);

  /**
   * §C：uin 是否在登录者的好友列表中（好友列表已加载时准确；未加载/未登录 → false=未知）。
   * 档案列表/首页的事实标签（好友 / 他人空间）据此判定，不再无条件写「好友」。
   */
  function isFriendUin(uin?: string | number | null) {
    if (!uin) return false;
    return friends.value.some((f) => String(f.uin) === String(uin));
  }

  return {
    mode, inputUin, profile, validating, validateError,
    friends, friendsLoading, friendsLoaded, friendsError,
    loadFriends, filterFriends, validate, setMode, pickFriend, reset,
    effectiveUin, isOtherUser, isFriendUin,
  };
});
