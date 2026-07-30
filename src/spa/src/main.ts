import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.scss'
import './styles/base.scss'
// LightGallery 必需的 CSS：核心样式 + 各插件样式（zoom/video/thumbnail/rotate/fullscreen/autoplay）
// 不导入这些会导致图片/视频查看器完全无样式，弹出层裸露不可用
import 'lightgallery/css/lightgallery-bundle.css'
import './styles/lightgallery-theme.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
