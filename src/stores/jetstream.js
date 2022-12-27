import { defineStore } from 'pinia'

export const useJetStreamStore = defineStore('JetStream', {
  state: () => ({ messages: [] })
})
