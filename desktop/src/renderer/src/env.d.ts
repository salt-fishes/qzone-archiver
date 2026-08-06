/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  api: {
    app: {
      getInfo(): Promise<{ version: string; platform: string; arch: string }>;
      openExternal(url: string): Promise<void>;
    };
    auth: {
      getStatus(): Promise<{ loggedIn: boolean; qqNumber?: string; nickname?: string; avatar?: string }>;
      showLogin(): Promise<void>;
      getOverview(): Promise<any>;
      logout(): Promise<void>;
    };
    config: {
      get(): Promise<any>;
      set(partial: any): Promise<any>;
      reset(): Promise<any>;
      import(path?: string): Promise<any>;
      export(path?: string): Promise<any>;
    };
    backup: {
      start(payload: { taskId?: string; modules: string[]; config?: any; targetDir: string }): Promise<{ ok: boolean; taskId?: string; error?: string }>;
      pause(taskId?: string): Promise<{ ok: boolean; error?: string }>;
      resume(taskId?: string): Promise<{ ok: boolean; error?: string }>;
      cancel(taskId?: string): Promise<{ ok: boolean; error?: string }>;
      getState(): Promise<any>;
    };
    download: {
      start(task: any, targetDir?: string): Promise<any>;
      pause(): Promise<any>;
      resume(): Promise<any>;
      cancel(): Promise<any>;
      getState(): Promise<any>;
    };
    fs: {
      selectDirectory(title?: string): Promise<{ canceled: boolean; path?: string }>;
      openPath(path: string): Promise<void>;
      showInFolder(path: string): Promise<void>;
    };
    zip: {
      create(srcDir: string, destPath: string): Promise<any>;
    };
    viewer: {
      open(backupPath: string): Promise<any>;
    };
    on(channel: string, cb: (payload: any) => void): () => void;
  };
}
