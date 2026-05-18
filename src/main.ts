import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import EditorView from './views/EditorView.vue'
import './styles/main.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/doc/:id', name: 'editor', component: EditorView }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
