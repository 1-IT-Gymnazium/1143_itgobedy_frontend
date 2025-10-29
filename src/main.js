import './assets/main.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import socketPlugin from './plugins/socket.js'

createApp(App)
  .use(router)
  .use(socketPlugin)
  .mount('#app')
