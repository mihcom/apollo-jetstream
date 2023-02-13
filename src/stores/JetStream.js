import { defineStore } from 'pinia'
import moment from 'moment'
import { computed, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { debounce } from 'throttle-debounce'
import NatsWorker from '../api/nats?worker&inline'

export const useJetStreamStore = defineStore('JetStream', () => {
  const timeRange = ref('Live'),
    loading = ref(false),
    duration = computed(() => {
      if (timeRange.value === 'Live') {
        return moment.duration(5, 'minutes')
      }

      const parsedTime = /\w+\s+(\d+)\s+(\w+)/.exec(timeRange.value),
        number = parseInt(parsedTime[1]),
        unit = parsedTime[2].toLowerCase()

      return moment.duration(number, unit).asMilliseconds()
    }),
    startTime = computed(() => moment().subtract(duration.value).valueOf()),
    streams = ref([]),
    messages = ref([]),
    mappedMessages = new Map(),
    selectedMessage = ref(undefined),
    failures = ref([]),
    worker = new NatsWorker(),
    toast = useToast()

  let connectionErrorToastId

  worker.onmessage = event => {
    const { data } = event,
      cancelLoading = debounce(500, () => (loading.value = false)),
      cancelLoadingOnTimeout = setTimeout(() => cancelLoading(), 500)

    switch (data.type) {
      case 'streams':
        streams.value = data.streams
        break

      case 'message':
        messages.value.push(data.message)
        cancelLoading()
        clearTimeout(cancelLoadingOnTimeout)

        const messageIdHeader = data.message.headers?.get('Tracing.Headers.Event.MessageId')

        if (messageIdHeader === undefined) {
          return
        }

        let mapped = mappedMessages.get(data.message.info.stream)

        if (mapped === undefined) {
          mapped = new Map()
          mappedMessages.set(data.message.info.stream, mapped)
        }

        mapped.set(messageIdHeader[0], data.message)

        break

      case 'messageTrace':
        messagesTraceCache.get(data.message.messageId).value.push(data.message)
        break

      case 'messageFailure':
        failures.value.push(data.message)
        break

      case 'natsConnectivityChanged':
        switch (data.status) {
          case 'connectionError':
            connectionErrorToastId = toast.error(data.message, { timeout: 0 })
            break

          case 'reconnecting':
            toast.info('Restoring connection to NATS server', { timeout: 0 })
            break

          case 'connected':
            if (connectionErrorToastId) {
              toast.clear(connectionErrorToastId)
              toast.success('Connected to NATS server')
            }
            break

          case 'reconnect':
            toast.clear()
            toast.success('Connected to NATS server')
            break
        }

        break

      default:
        throw `Unknown message type: ${data.type}`
    }
  }

  worker.onerror = error => {
    error.preventDefault()
    toast.error(error.message, { timeout: 0 })
  }

  watch(timeRange, () => fetchStreams())

  function fetchStreams() {
    loading.value = true
    selectedMessage.value = undefined
    messages.value = []

    worker.postMessage({
      type: 'getStreams',
      startTime: moment(startTime.value).toISOString()
    })
  }

  function listenForFailures() {
    worker.postMessage({
      type: 'listenForFailures',
      startTime: moment(startTime.value).toISOString()
    })
  }

  const messagesTraceCache = new Map()
  function fetchMessageTrace(messageId) {
    let messageTrace = messagesTraceCache.get(messageId)

    if (messageTrace) {
      return messageTrace
    }

    messageTrace = ref([])
    messagesTraceCache.set(messageId, messageTrace)

    worker.postMessage({
      type: 'fetchMessageTrace',
      messageId
    })

    return messageTrace
  }

  function selectMessage(stream, messageId) {
    selectedMessage.value = mappedMessages.get(stream).get(messageId)
  }

  fetchStreams()
  listenForFailures()

  return {
    timeRange,
    startTime,
    duration,
    streams,
    loading,
    messages,
    selectedMessage,
    selectedTimestamp: ref(undefined),
    failures,
    fetchMessageTrace,
    selectMessage
  }
})
