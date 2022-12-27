import { defineStore } from 'pinia'
import { getStreams } from '../api/nats.js'

export const useJetStreamStore = defineStore('JetStream', {
  state: () => ({ streams: [] }),
  actions: {
    async fetchStreams() {
      this.streams = await getStreams()
    }
  }
})
