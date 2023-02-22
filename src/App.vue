<script setup>
import Message from './components/Message'
import Timeline from './components/Timeline'
import { onMounted, ref } from 'vue'
import hotkeys from 'hotkeys-js'

const showHelp = ref(false)

onMounted(() => {
  hotkeys('f1', e => {
    e.preventDefault()
    showHelp.value = !showHelp.value
  })
})
</script>

<template>
  <v-app theme="dark">
    <v-main>
      <v-icon class="help-cta" title="Show help (F1)" @click="showHelp = true">mdi-help-box</v-icon>
      <Message />
      <Timeline />
      <v-dialog v-model="showHelp" max-width="65em" class="help-content">
        <v-card>
          <v-toolbar color="primary" dense>
            <v-toolbar-title>Apollo JetStream Help </v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <h3>Keyboard shortcuts</h3>
            <ul>
              <li><span class="hint">F1</span> - show this help</li>
              <li><span class="hint">Ctrl+Right</span> - select next message in stream</li>
              <li><span class="hint">Ctrl+Left</span> - select previous message in stream</li>
              <li><span class="hint">Shift+Right</span> - scroll timeline to the right</li>
              <li><span class="hint">Shift+Left</span> - scroll timeline to the left</li>
            </ul>
            <h3>Actions</h3>
            <ul>
              <li><span class="hint">Click</span> message in timeline to see message contents and tracing</li>
              <li>
                <span class="hint">Select time range with mouse</span> or <span class="hint">scroll mouse wheel up</span> to zoom into selected time range (can
                be done multiple times)
              </li>
              <li>Press <span class="hint">Esc</span> or <span class="hint">scroll mouse wheel down</span> to get to previous zoom level</li>
            </ul>
            <h3>Notes</h3>
            <ul>
              <li>The app automatically restores NATS connection if it is lost</li>
              <li>Tha app detect streams creation or removal</li>
            </ul>
          </v-card-text>
          <v-card-actions class="justify-end">
            <v-btn text @click="showHelp = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
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

  .help-cta
    position absolute
    top 4px
    right 4px
    z-index 1
    cursor pointer
    transition all 0.2s ease-in-out
    color rgb(187,134,252)

    &:hover
      transform scale(1.2)

.help-content
  h3
    margin-bottom 0.5em

  ul
    margin-left 1em
    margin-bottom 1em

  .hint
    background-color #333333
    border-radius 4px
    padding 0 0.5em
    color #ffffff
    font-family monospace
    font-size 0.9em
</style>
