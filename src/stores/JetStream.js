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
    worker = new NatsWorker(),
    toast = useToast()

  worker.onmessage = event => {
    const { data } = event,
      cancelLoading = debounce(500, () => (loading.value = false)),
      cancelLoadingOnTimeout = setTimeout(() => cancelLoading(), 500)

    if (data.type === 'streams') {
      streams.value = data.streams
    } else if (data.type === 'message') {
      messages.value.push(data.message)
      cancelLoading()
      clearTimeout(cancelLoadingOnTimeout)
    }
  }

  worker.onerror = error => {
    toast.error(error.message, { timeout: 0 })
  }

  watch(timeRange, () => fetchStreams())

  async function fetchStreams() {
    loading.value = true
    messages.value = []

    worker.postMessage({
      type: 'getStreams',
      startTime: moment(startTime.value).toISOString()
    })
  }

  // noinspection JSIgnoredPromiseFromCall
  fetchStreams()

  return {
    timeRange,
    startTime,
    duration,
    streams,
    loading,
    messages,
    selectedMessage: ref(undefined)
  }
})
