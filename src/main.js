import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import Toast from 'vue-toastification'
import { useToast } from 'vue-toastification'
import 'vue-toastification/dist/index.css'

loadFonts()

const toastOptions = {
  position: 'top-right',
  timeout: 5000,
  closeOnClick: true
}

window.onerror = function (message) {
  const toast = useToast()
  toast.error(`Error: ${message}`, { timeout: 0 })

  return true
}

window.onunhandledrejection = function (errorEvent) {
  const toast = useToast()
  toast.error(`An async operation failed: ${errorEvent.reason}`, { timeout: 0 })

  console.log(errorEvent)

  return true
}

createApp(App).use(vuetify).use(createPinia()).use(Toast, toastOptions).mount('#app')
