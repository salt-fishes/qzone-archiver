import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/fonts.scss'
import './styles/tokens.scss'
import './styles/base.scss'

const app = createApp(App)
// 全局错误哨兵：排查渲染异常时可在控制台/自动化里读 window.__errs
app.config.errorHandler = (err, _inst, info) => {
  const w = window as any
  w.__errs = w.__errs || []
  w.__errs.push(`${String(err)} [${info}]`)
  console.error(err)
}
app.use(createPinia())
app.use(router)
app.mount('#app')
