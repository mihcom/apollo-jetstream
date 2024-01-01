<script setup>
import moment from 'moment/moment.js'
import { millis } from 'nats.ws'
import { ref, toRefs } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import ConsumersInfo from './ConsumersInfo'

const store = useJetStreamStore(),
  props = defineProps({
    stream: {
      type: Object,
      required: true
    }
  }),
  { stream } = toRefs(props),
  consumers = ref([]),
  openDialog = ref(false)

async function showConsumers(stream) {
  consumers.value = await store.getConsumers(stream)
  openDialog.value = true
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
</script>

<template>
  <v-card>
    <v-toolbar color="primary" dense>
      <v-toolbar-title><v-icon>mdi-tray-full</v-icon> {{ stream.config.name }} </v-toolbar-title>
    </v-toolbar>
    <v-card-text>
      <v-row v-if="stream.config.description">
        <v-col :cols="4">Description</v-col>
        <v-col>{{ stream.config.description }}</v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-filter</v-icon> Subjects</v-col>
        <v-col>{{ stream.config.subjects.join(', ') }}</v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-database</v-icon>Retention policy</v-col>
        <v-col
          >{{ capitalize(stream.config.retention) }}
          <ul class="limits">
            <li v-if="stream.config.max_age > 0">{{ moment.duration(millis(stream.config.max_age)).humanize() }} lifetime</li>
            <li v-if="stream.config.max_bytes > 0">
              {{
                stream.config.max_bytes.toLocaleString('da-DK', {
                  style: 'unit',
                  unit: 'byte',
                  unitDisplay: 'long'
                })
              }}
              ({{
                (stream.config.max_bytes / 1024 / 1024).toLocaleString('da-DK', {
                  style: 'unit',
                  unit: 'megabyte',
                  unitDisplay: 'long'
                })
              }})
            </li>
            <li v-if="stream.config.max_msgs > 0">{{ stream.config.max_msgs.toLocaleString('da-DK') }} messages</li>
          </ul>
        </v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-email-multiple</v-icon> Messages</v-col>
        <v-col>{{ stream.state.messages.toLocaleString('da-DK') }}</v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-content-save</v-icon> Size</v-col>
        <v-col>
          {{
            (stream.state.bytes / 1024 / 1024).toLocaleString('da-DK', {
              style: 'unit',
              unit: 'megabyte',
              unitDisplay: 'long'
            })
          }}</v-col
        >
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-human-queue</v-icon> Consumers</v-col>
        <v-col>
          <v-tooltip text="Click to see consumers">
            <template v-slot:activator="{ props }">
              <v-btn variant="flat" v-bind="props" :loading="store.loading" @click="showConsumers(stream)">{{
                (stream.state.consumer_count - 1).toLocaleString('da-DK')
              }}</v-btn>
            </template>
          </v-tooltip>
        </v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-calendar-clock</v-icon> First message</v-col>
        <v-col>
          <div v-if="stream.state.first_ts != '0001-01-01T00:00:00Z'">
            {{ moment(stream.state.first_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
              moment.duration(moment().diff(moment(stream.state.first_ts))).humanize()
            }}
            ago)
          </div>
          <div v-else>never</div>
        </v-col>
      </v-row>
      <v-row>
        <v-col :cols="4"><v-icon>mdi-calendar-clock</v-icon> Last message</v-col>
        <v-col>
          <div v-if="stream.state.last_ts != '0001-01-01T00:00:00Z'">
            {{ moment(stream.state.last_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
              moment.duration(moment().diff(moment(stream.state.last_ts))).humanize()
            }}
            ago)
          </div>
          <div v-else>never</div>
        </v-col>
      </v-row>
    </v-card-text>
    <v-card-actions class="justify-end">
      <v-btn variant="text" @click="$emit('close')">Close</v-btn>
    </v-card-actions>
  </v-card>
  <v-dialog v-model="openDialog" max-width="90vw">
    <consumers-info :consumers="consumers" @close="openDialog = false" />
  </v-dialog>
</template>

<style lang="stylus" scoped>
ul.limits
  margin-left 1em
</style>
