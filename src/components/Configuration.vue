<script setup>
import { ref, toRefs } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'

const props = defineProps({
    visible: {
      type: Boolean,
      required: true,
      default: false
    }
  }),
  { visible } = toRefs(props),
  store = useJetStreamStore(),
  natsServerAddress = ref(store.natsServerAddress),
  emit = defineEmits(['close']),
  valid = ref(true)

function apply(e) {
  e.preventDefault()
  store.natsServerAddress = natsServerAddress.value
  emit('close')
}
</script>

<template>
  <v-dialog v-model="visible" max-width="65em" class="configuration-content" @update:model-value="$emit('close')">
    <v-card>
      <v-toolbar color="primary" dense>
        <v-toolbar-title>Apollo JetStream Configuration</v-toolbar-title>
      </v-toolbar>
      <v-card-text>
        <v-form v-model="valid" @submit="apply">
          <v-text-field
            label="NATS server address"
            prepend-icon="mdi-server"
            placeholder="localhost:444"
            hint="Enter WebSockets address of the NATS server"
            prefix="ws://"
            :rules="[
              v => !!v || 'NATS server is required',
              v => !!v.match(/^[-a-zA-Z0-9%._+~#=]{1,256}:[\d]{1,5}$/) || 'NATS server address must be a valid address (host:port)'
            ]"
            v-model="natsServerAddress"
          >
          </v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn text @click="apply" :disabled="!valid">Apply</v-btn>
        <v-btn text @click="$emit('close')">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="stylus"></style>
