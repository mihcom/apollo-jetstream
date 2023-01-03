<script setup>
import { useJetStreamStore } from '../stores/JetStream.js'
import { ref, watch } from 'vue'
import JSONFormatter from 'json-formatter-js'
import jwt_decode from 'jwt-decode'
import moment from 'moment'
import { millis } from 'nats.ws'

const store = useJetStreamStore(),
  messageContainer = ref(null)

watch(
  () => store.selectedMessage,
  message => {
    messageContainer.value.innerHTML = ''

    if (message) {
      const data = {
        published: moment(millis(message.info.timestampNanos)).format('DD MMM HH:mm:ss.SSS'),
        stream: message.info.stream,
        subject: message.subject
      }

      if (message.headers) {
        const headers = {}

        message.headers.headers.forEach((value, key) => {
          let headerValue = value[0]

          if (headerValue[0] === '{') {
            headerValue = JSON.parse(headerValue)
          } else if (key === 'Leapwork.Shared.Common.Messaging.Infrastructure.Message.Headers.Jwt') {
            headerValue = jwt_decode(headerValue)
          }

          headers[key] = headerValue
        })

        data.headers = headers
      }

      if (message.data) {
        const stringData = new TextDecoder().decode(message.data)

        if (stringData && stringData.length) {
          data.data = JSON.parse(new TextDecoder().decode(message.data))

          if (data.data.jwt) {
            data.data.jwt = jwt_decode(data.data.jwt)
          }
        }
      }

      messageContainer.value.appendChild(
        new JSONFormatter(data, 2, {
          animateOpen: true,
          animateClose: true,
          hoverPreviewEnabled: true,
          hoverPreviewArrayCount: 100,
          hoverPreviewFieldCount: 5,
          theme: 'dark'
        }).render()
      )
    }
  }
)
</script>

<template>
  <div ref="messageContainer"></div>
</template>
