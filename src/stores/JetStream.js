import { defineStore } from 'pinia'
import { getStreams } from '../api/nats.js'
import moment from 'moment'
import { computed, ref, watch } from 'vue'

export const useJetStreamStore = defineStore('JetStream', () => {
  const timeRange = ref('Last 5 minutes'),
    loading = ref(false),
    startTime = computed(() => {
      const parsedTime = /\w+\s+(\d+)\s+(\w+)/.exec(timeRange.value),
        number = parseInt(parsedTime[1]),
        unit = parsedTime[2].toLowerCase()

      return moment().subtract(number, unit).valueOf()
    }),
    streams = ref([])

  watch(timeRange, () => fetchStreams())

  async function fetchStreams() {
    loading.value = true
    streams.value = await getStreams(moment(startTime.value).toISOString())
    loading.value = false
  }

  // noinspection JSIgnoredPromiseFromCall
  fetchStreams()

  return {
    timeRange,
    startTime,
    streams,
    loading
  }
})
