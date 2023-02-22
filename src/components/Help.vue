<script setup>
import { toRefs } from 'vue'

const props = defineProps({
    visible: {
      type: Boolean,
      required: true,
      default: false
    }
  }),
  { visible } = toRefs(props)
</script>

<template>
  <v-dialog v-model="visible" max-width="65em" class="help-content" @update:model-value="$emit('close')">
    <v-card>
      <v-toolbar color="primary" dense>
        <v-toolbar-title>Apollo JetStream Help</v-toolbar-title>
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
            <span class="hint">Select time range with mouse</span> or <span class="hint">scroll mouse wheel up</span> to zoom into selected time range (can be
            done multiple times)
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
        <v-btn text @click="$emit('close')">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="stylus">
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
