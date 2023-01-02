import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

loadFonts()

const toastOptions = {
  position: 'top-right',
  timeout: 5000,
  closeOnClick: true
}

createApp(App).use(vuetify).use(createPinia()).use(Toast, toastOptions).mount('#app')
