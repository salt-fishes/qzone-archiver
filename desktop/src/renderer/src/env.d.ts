/// <reference types="vite/client" />

declare module '*.vue' {
  const component: any;
  export default component;
}

declare global {
  interface Window {
    api: {
      app: {
        getInfo(): Promise<{ version: string; platform: string; arch: string }>;
        openExternal(url: string): Promise<void>;
        checkUpdate(): Promise<{ ok: boolean; current?: string; latest?: string; hasUpdate?: boolean; url?: string; notes?: string; publishedAt?: string; error?: string }>;
        /** v4.9：打开日志目录（main.log + backup-<taskId>.log） */
        openLogs(): Promise<void>;
      };
      auth: {
        getStatus(): Promise<{ loggedIn: boolean; qqNumber?: string; nickname?: string; avatar?: string; fromCache?: boolean }>;
        showLogin(): Promise<void>;
        getOverview(): Promise<any>;
        logout(): Promise<{ error?: string } | null>;
      };
      config: {
        get(): Promise<any>;
        set(partial: any): Promise<any>;
        reset(): Promise<any>;
        import(path?: string): Promise<any>;
        export(path?: string): Promise<any>;
      };
      backup: {
        start(payload: { taskId?: string; modules: string[]; config?: any; targetDir: string; targetUin?: string }): Promise<{ ok: boolean; taskId?: string; error?: string }>;
        pause(taskId?: string): Promise<{ ok: boolean; error?: string }>;
        resume(taskId?: string): Promise<{ ok: boolean; error?: string }>;
        cancel(taskId?: string): Promise<{ ok: boolean; error?: string }>;
        getState(): Promise<any>;
        getHistory(): Promise<{
          ok?: boolean;
          history?: {
            taskId?: string | null;
            completedAt: number;
            targetDir: string;
            name: string;
            modules: string[];
            results: Record<string, string>;
            total: number;
            moduleCounts: Record<string, number>;
            size: number;
            files: number;
            target?: { uin: string; nickname?: string };
          }[];
        }>;
        listAlbums(): Promise<{ ok: boolean; albums?: { id: string | number; name: string; classid?: string | number; className?: string; total?: number; desc?: string }[]; error?: string }>;
        listFriends(): Promise<{ ok: boolean; friends?: { uin: string; nickname?: string; remark?: string; avatar?: string }[]; error?: string }>;
        validateTarget(uin: string): Promise<{ ok: boolean; isOwner?: boolean; uin?: string; nickname?: string; avatar?: string; code?: number; notice?: string; error?: string }>;
        engineInject(): Promise<{ ok: boolean; error?: string }>;
        /** v4.9.1：删除一条备份历史记录（只删记录不动文件） */
        deleteHistory(taskId: string): Promise<{ ok: boolean; removed?: number; error?: string }>;
      };
      download: {
        pause(): Promise<any>;
        resume(): Promise<any>;
        cancel(): Promise<any>;
        clearDone(): Promise<any>;
        getState(): Promise<any>;
      };
      fs: {
        selectDirectory(title?: string): Promise<{ canceled: boolean; path?: string }>;
        openPath(path: string): Promise<void>;
        showInFolder(path: string): Promise<void>;
        scanBackups(root: string): Promise<{ backups: { path: string; name: string; mtime: number; size: number; files: number }[] }>;
        saveDialog(opts: { title?: string; defaultPath?: string }): Promise<{ canceled: boolean; path?: string }>;
        writeText(path: string, content: string): Promise<{ ok: boolean; error?: string }>;
      };
      zip: {
        create(srcDir: string, destPath: string): Promise<any>;
      };
      /** v4.7：备份目标头像（主进程本地缓存 → data URL） */
      avatars: {
        get(uin: string | number): Promise<{ ok: boolean; dataUrl: string | null }>;
      };
      /** v4.7.4：内置表情图片（主进程读 assets/emoticons → data URL） */
      emoticons: {
        get(id: string | number): Promise<{ ok: boolean; dataUrl: string | null }>;
      };
      viewer: {
        open(backupPath: string): Promise<any>;
      };
      on(channel: string, cb: (payload: any) => void): () => void;
    };
  }
}

export {};
