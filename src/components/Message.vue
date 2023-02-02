<script setup>
import { useJetStreamStore } from '../stores/JetStream'
import MessageContent from './MessageContent'
import MessageTrace from './MessageTrace'

const store = useJetStreamStore()
</script>

<template>
  <div ref="messageContainer" class="message-container">
    <message-content class="message-content" v-if="store.selectedMessage" />
    <message-trace class="message-tracing" v-if="store.selectedMessage" />
    <div class="no-message" v-else>Select a message to see its content and tracing</div>
  </div>
</template>

<style scoped lang="stylus">
.message-container
  height 50%
  position fixed
  top 0
  left 0
  width 100%
  display flex

  .message-content
    flex 1

  .message-tracing
    min-width 27em

  .no-message
    height 100%
    display flex
    align-items center
    justify-content center
    flex 1
</style>
