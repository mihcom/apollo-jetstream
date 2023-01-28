<script setup>
import { useJetStreamStore } from '../stores/JetStream'
import { ref, onMounted, watch, unref } from 'vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import JsonEditorVue from 'json-editor-vue'
import jwt_decode from 'jwt-decode'
import moment from 'moment'
import { millis } from 'nats.ws'

const store = useJetStreamStore(),
  viewModelBinding = ref()

onMounted(() => {
  watch(() => store.selectedMessage, outputData)

  outputData()
})

function outputData() {
  const message = unref(store.selectedMessage),
    viewModel = {
      published: moment(millis(message.info.timestampNanos)).format('DD MMM HH:mm:ss.SSS'),
      stream: message.info.stream,
      subject: message.subject
    }

  if (message.headers) {
    const headers = {}

    message.headers.forEach((value, key) => {
      let headerValue = value[0]

      if (headerValue[0] === '{') {
        headerValue = JSON.parse(headerValue)
      } else if (key === 'Leapwork.Shared.Common.Messaging.Infrastructure.Message.Headers.Jwt') {
        headerValue = jwt_decode(headerValue)
      }

      headers[key] = headerValue
    })

    viewModel.headers = headers
  }

  if (message.data) {
    const stringData = new TextDecoder().decode(message.data)

    if (stringData && stringData.length) {
      viewModel.content = JSON.parse(new TextDecoder().decode(message.data))

      if (viewModel.content.jwt) {
        viewModel.content.jwt = jwt_decode(viewModel.content.jwt)
      }
    }
  }

  viewModelBinding.value = viewModel
}
</script>

<template>
  <JsonEditorVue v-model="viewModelBinding" class="jse-theme-dark" readOnly />
</template>

<style scoped lang="stylus"></style>
