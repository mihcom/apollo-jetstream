<script setup>
import Message from './components/Message'
import Timeline from './components/Timeline'
import Help from './components/Help'
import Configuration from './components/Configuration'
import { onMounted, ref } from 'vue'
import hotkeys from 'hotkeys-js'

const showHelp = ref(false),
  showConfiguration = ref(false)

onMounted(() => {
  hotkeys('f1', e => {
    e.preventDefault()
    showHelp.value = !showHelp.value
  })

  hotkeys('f2', e => {
    e.preventDefault()
    showConfiguration.value = !showConfiguration.value
  })
})
</script>

<template>
  <v-app>
    <v-main>
      <v-icon class="help cta" title="Show help (F1)" @click="showHelp = true">mdi-help-box</v-icon>
      <v-icon class="configuration cta" title="Configuration (F2)" @click="showConfiguration = true">mdi-cog</v-icon>
      <Message />
      <Timeline />
      <Help :visible="showHelp" @close="showHelp = false" />
      <Configuration :visible="showConfiguration" @close="showConfiguration = false" />
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

  .help
    position absolute
    top 4px
    right 30px
    z-index 1

  .configuration
    position absolute
    top 4px
    right 4px
    z-index 1

  .cta
    cursor pointer
    transition all 0.2s ease-in-out
    color white

    &:hover
      transform scale(1.2)
</style>
