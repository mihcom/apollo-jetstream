<script setup>
import Message from './components/Message'
import Timeline from './components/Timeline'
</script>

<template>
  <v-app theme="dark">
    <v-main>
      <Message />
      <Timeline />
    </v-main>
  </v-app>
</template>

<style lang="stylus"></style>

<style scoped lang="stylus">
.v-main
  display flex
  flex-direction column
  height 100vh
  overflow hidden
  background-color #1e1e1e

  .message-container
    //background-color cornflowerblue
    height 50%

  .timeline
    border-top 1px solid #333333
    //background-color darkgray
    height 50%
</style>
