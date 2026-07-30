/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 由扩展端 exportToSpa 生成的数据文件全局变量声明
interface Window {
  userInfo?: import('@/types').UserInfo
  messagesIndex?: import('@/types').MessageIndex[]
  [key: `messages_${number}`]: any
}

declare module 'flexsearch'
declare module 'vue-virtual-scroller'
